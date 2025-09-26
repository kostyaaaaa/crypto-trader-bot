// trading/core/monitorPositions.js
import axios from 'axios';
import {
  openMarketOrder,
  cancelStopOrders,
  placeStopLoss,
  placeTakeProfit,
} from '../binance/binance.js';
import { getActivePositions } from './positions.js';
import {
  addToPosition,
  adjustPosition,
  getHistory,
  reconcilePositions,
  updateStopPrice,
  updateTakeProfits,
} from './historyStore.js';

const TRADE_MODE = process.env.TRADE_MODE || 'paper';

// === API Binance ===
async function getMarkPrice(symbol) {
  try {
    const res = await axios.get(
      'https://fapi.binance.com/fapi/v1/premiumIndex',
      { params: { symbol } },
    );
    return parseFloat(res.data.markPrice);
  } catch (e) {
    return null;
  }
}

// Витягуємо OPEN-док з історії (БД)
async function getOpenHistoryDoc(symbol) {
  try {
    const hist = await getHistory(symbol, 10);
    if (!Array.isArray(hist)) return null;
    const open = hist.find((h) => h.status === 'OPEN');
    return open || null;
  } catch {
    return null;
  }
}

// === Основний моніторинг ===
export async function monitorPositions({ symbol, strategy }) {
  let positions = [];
  try {
    positions = await getActivePositions(symbol);
  } catch {
    return;
  }

  const reconciled = await reconcilePositions();

  if (!positions.length) return;

  const price = await getMarkPrice(symbol);
  if (price == null) return;

  for (let pos of positions) {
    // ВАЖЛИВО: це live-позиція з Binance
    // очікуємо, що pos.size = КІЛЬКІСТЬ МОНЕТ (qty), entryPrice — середня ціна входу
    const { side, entryPrice, size: liveQty, orders } = pos;
    const dir = side === 'LONG' ? 1 : -1;
    const binanceSide = side === 'LONG' ? 'BUY' : 'SELL';

    // поточний SL із відкритих ордерів
    const currentSL = Array.isArray(orders)
      ? (orders.find((o) => o.type === 'SL')?.price ?? null)
      : null;

    // ---- читаємо додачі з БД (а не з Binance!) ----
    const openDoc = await getOpenHistoryDoc(symbol);
    const addsCount = openDoc?.adds?.length || 0;

    /* ===== 1) TRAILING ===== */
    const trailingCfg = strategy?.exits?.trailing;
    // зберігаємо стейт трелінгу в оперативці на об'єкті pos (можемо винести у БД пізніше)
    if (trailingCfg?.use && entryPrice) {
      try {
        const movePct = ((price - entryPrice) / entryPrice) * 100 * dir;

        if (!pos.trailing?.active && movePct >= trailingCfg.startAfterPct) {
          pos.trailing = {
            active: true,
            startAfterPct: trailingCfg.startAfterPct,
            trailStepPct: trailingCfg.trailStepPct,
            anchor: price,
          };
        }

        if (pos.trailing?.active) {
          if (side === 'LONG' && price > (pos.trailing.anchor || 0)) {
            pos.trailing.anchor = price;
          }
          if (side === 'SHORT' && price < (pos.trailing.anchor || Infinity)) {
            pos.trailing.anchor = price;
          }

          const newStop =
            side === 'LONG'
              ? pos.trailing.anchor * (1 - trailingCfg.trailStepPct / 100)
              : pos.trailing.anchor * (1 + trailingCfg.trailStepPct / 100);

          const needUpdate =
            (side === 'LONG' && (!currentSL || newStop > currentSL)) ||
            (side === 'SHORT' && (!currentSL || newStop < currentSL));

          if (needUpdate) {
            if (TRADE_MODE === 'live') {
              await cancelStopOrders(symbol, { onlySL: true }); // ❗️TP не чіпаємо
              await placeStopLoss(symbol, side, newStop, liveQty); // qty = liveQty (монети)
            }

            // лог у історію
            await adjustPosition(symbol, {
              type: 'SL',
              price: newStop,
              size: liveQty,
            });

            await updateStopPrice(symbol, newStop, 'TRAIL');
          }
        }
      } catch {}
    }

    /* ===== 2) DCA / Adds ===== */
    const { sizing } = strategy;
    if (sizing && sizing.maxAdds > 0) {
      const movePct = (Number(sizing.addOnAdverseMovePct) || 0) / 100;
      const adversePrice =
        side === 'LONG'
          ? entryPrice * (1 - movePct)
          : entryPrice * (1 + movePct);

      const condition =
        (side === 'LONG' && price <= adversePrice) ||
        (side === 'SHORT' && price >= adversePrice);

      if (condition && addsCount < sizing.maxAdds) {
        // Беремо поточний нотіонал з live-даних: qty * entryPrice
        const notionalUsd = entryPrice * liveQty; // $-обсяг
        const mult = Number(sizing.addMultiplier) || 1;
        const addSizeUsd = notionalUsd * mult;
        const addQty = addSizeUsd / price; // монети

        if (!Number.isFinite(addQty) || addQty <= 0) {
          continue;
        }

        if (TRADE_MODE === 'live') {
          try {
            await openMarketOrder(symbol, binanceSide, addQty.toFixed(3));

            // 🔥 1) одразу оновлюємо SL на повний новий обсяг
            const newTotalQty = liveQty + addQty;
            if (currentSL) {
              await cancelStopOrders(symbol, { onlySL: true });
              await placeStopLoss(symbol, side, currentSL, newTotalQty);

              await adjustPosition(symbol, {
                type: 'SL',
                price: currentSL,
                size: newTotalQty,
              });

              await updateStopPrice(symbol, currentSL, 'ADD_RESET');
            }

            // ⚠️ Запис у ІСТОРІЮ (БД): просто фіксуємо долив (історія знає свій формат)
            await addToPosition(symbol, { qty: addQty, price });
          } catch {}
        } else {
          const newTotalQty = liveQty + addQty;

          // SL (симуляція)
          if (currentSL) {
            await adjustPosition(symbol, {
              type: 'SL',
              price: currentSL,
              size: newTotalQty,
            });

            await updateStopPrice(symbol, currentSL, 'ADD_RESET');
          }

          await addToPosition(symbol, { qty: addQty, price });
        }
      }
    }
  }
}
