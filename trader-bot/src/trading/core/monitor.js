// trading/core/monitorPositions.js
import axios from 'axios';
import { loadDocs } from '../../storage/storage.js';
import {
  cancelStopOrders,
  openMarketOrder,
  placeStopLoss,
} from '../binance/binance.js';
import { getActivePositions } from './binance-positions-manager.js';
import {
  addToPosition,
  adjustPosition,
  getHistory,
  updateStopPrice,
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

  if (!positions.length) return;

  const price = await getMarkPrice(symbol);
  if (price == null) return;

  // Отримуємо останній аналіз
  let lastAnalysis = null;
  try {
    const analysisDocs = await loadDocs('analysis', symbol, 1);
    if (Array.isArray(analysisDocs) && analysisDocs.length > 0) {
      lastAnalysis = analysisDocs[0];
    }
  } catch {}

  for (let pos of positions) {
    const { side, entryPrice, size: liveQty, orders } = pos;
    const dir = side === 'LONG' ? 1 : -1;
    const binanceSide = side === 'LONG' ? 'BUY' : 'SELL';

    const currentSL = Array.isArray(orders)
      ? (orders.find((o) => o.type === 'SL')?.price ?? null)
      : null;

    const openDoc = await getOpenHistoryDoc(symbol);
    const addsCount = openDoc?.adds?.length || 0;

    /* ===== 1) TRAILING ===== */
    const trailingCfg = strategy?.exits?.trailing;

    // зберігаємо стейт трелінгу в оперативці на об'єкті pos (можемо винести у БД пізніше)
    if (trailingCfg?.use && entryPrice) {
      try {
        let trailingState = openDoc?.trailing || null;

        const movePct = ((price - entryPrice) / entryPrice) * 100 * dir;

        if (!trailingState?.active && movePct >= trailingCfg.startAfterPct) {
          trailingState = {
            active: true,
            startAfterPct: trailingCfg.startAfterPct,
            trailStepPct: trailingCfg.trailStepPct,
            anchor: price,
          };
        }

        if (trailingState?.active) {
          if (side === 'LONG' && price > (trailingState.anchor || 0)) {
            trailingState.anchor = price;
          }
          if (side === 'SHORT' && price < (trailingState.anchor || Infinity)) {
            trailingState.anchor = price;
          }

          const newStop =
            side === 'LONG'
              ? trailingState.anchor * (1 - trailingCfg.trailStepPct / 100)
              : trailingState.anchor * (1 + trailingCfg.trailStepPct / 100);

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

            await updateStopPrice(symbol, newStop, 'TRAIL', trailingState);
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
      // Перевірка сигналу аналізу: якщо є останній аналіз і сигнал протилежний позиції, не додаємо
      if (
        lastAnalysis &&
        lastAnalysis.signal &&
        ((side === 'LONG' && lastAnalysis.signal === 'SHORT') ||
          (side === 'SHORT' && lastAnalysis.signal === 'LONG'))
      ) {
        continue;
      }

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

            // ❌ SL/TP більше не чіпаємо
            // ⚠️ Запис у ІСТОРІЮ (БД): просто фіксуємо долив
            await addToPosition(symbol, { qty: addQty, price });
          } catch {}
        } else {
          // Симуляція — теж не чіпаємо SL/TP
          await addToPosition(symbol, { qty: addQty, price });
        }
      }
    }
  }
}
