import axios from 'axios';
import {
  openMarketOrder,
  cancelStopOrders,
  placeStopLoss,
  placeTakeProfit,
} from '../binance/binance.js';
import { getActivePositions } from './positions.js';
import { addToPosition, adjustPosition, getHistory } from './historyStore.js';

const TRADE_MODE = process.env.TRADE_MODE || 'paper';
const addTracker = new Map(); // локальний трекер доливів

// === API Binance ===
async function getMarkPrice(symbol) {
  try {
    const res = await axios.get(
      'https://fapi.binance.com/fapi/v1/premiumIndex',
      { params: { symbol } },
    );
    return parseFloat(res.data.markPrice);
  } catch (e) {
    console.error(`❌ Failed to fetch markPrice for ${symbol}:`, e.message);
    return null;
  }
}

// === Основний моніторинг ===
export async function monitorPositions({ symbol, strategy }) {
  let positions = [];
  try {
    positions = await getActivePositions(symbol);
  } catch (err) {
    console.error(`❌ getActivePositions failed for ${symbol}:`, err.message);
    return;
  }

  if (!positions.length) {
    addTracker.delete(symbol);
    return;
  }

  const price = await getMarkPrice(symbol);
  if (price == null) return;

  for (let pos of positions) {
    const { side, entryPrice, size, orders } = pos; // ⬅ беремо orders
    const dir = side === 'LONG' ? 1 : -1;
    const binanceSide = side === 'LONG' ? 'BUY' : 'SELL';

    // поточний SL із відкритих ордерів
    const currentSL = Array.isArray(orders)
      ? (orders.find((o) => o.type === 'SL')?.price ?? null)
      : null;

    /* ===== 0) init addTracker з історії, якщо треба ===== */
    let tracker = addTracker.get(symbol);
    if (!tracker) {
      try {
        const hist = await getHistory(symbol, 1); // твій стор повертає останню OPEN-позицію по символу
        const open = Array.isArray(hist)
          ? hist.find((h) => h.status === 'OPEN') || hist[0]
          : null;
        const addsCount = open?.adds?.length || 0;
        const lastSize = open?.size || size;
        tracker = { lastSize, addsCount };
        addTracker.set(symbol, tracker);
      } catch {
        tracker = { lastSize: size, addsCount: 0 };
        addTracker.set(symbol, tracker);
      }
    }

    /* ===== 1) TRAILING ===== */
    const trailingCfg = strategy?.exits?.trailing;
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
          console.log(`🔛 Trailing activated for ${symbol} @ ${price}`);
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
              await cancelStopOrders(symbol, { onlySL: true }); // ❗️лишаємо TP
              await placeStopLoss(symbol, side, newStop, size); // ⬅ qty = size (в монетах), НЕ size/price
              console.log(
                `🛑 [LIVE] Trailing SL updated @ ${newStop} (anchor=${pos.trailing.anchor})`,
              );
            } else {
              console.log(
                `🛑 [PAPER] Trailing SL simulated @ ${newStop} (anchor=${pos.trailing.anchor})`,
              );
            }

            // історія
            await adjustPosition(symbol, {
              type: 'SL',
              price: newStop,
              size,
            });
          }
        }
      } catch (err) {
        console.error(`❌ Trailing logic failed for ${symbol}:`, err.message);
      }
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

      if (condition && tracker.addsCount < sizing.maxAdds) {
        const notionalUsd = entryPrice * size; // поточний обсяг у $
        const mult = Number(sizing.addMultiplier) || 1;
        const addSizeUsd = notionalUsd * mult;
        const addQty = addSizeUsd / price;

        if (!Number.isFinite(addQty) || addQty <= 0) {
          console.warn(
            `⚠️ Skipping add for ${symbol}: bad qty=${addQty}, entry=${entryPrice}, size=${size}, price=${price}`,
          );
          return;
        }

        if (TRADE_MODE === 'live') {
          try {
            await openMarketOrder(symbol, binanceSide, addQty.toFixed(3));

            tracker.addsCount += 1;
            tracker.lastSize = size + addQty; // новий загальний розмір у монетах
            addTracker.set(symbol, tracker);

            // 🔥 1) одразу оновлюємо SL на новий обсяг, якщо він був
            if (currentSL) {
              await cancelStopOrders(symbol, { onlySL: true });
              await placeStopLoss(symbol, side, currentSL, tracker.lastSize);
              console.log(
                `🛑 [LIVE] SL re-set after add → ${currentSL} @ size=${tracker.lastSize.toFixed(
                  3,
                )}`,
              );

              await adjustPosition(symbol, {
                type: 'SL',
                price: currentSL,
                size: tracker.lastSize,
              });
            }

            // 🎯 2) перевиставляємо TP грід на увесь новий обсяг
            const tpCfg = strategy?.exits?.tp;
            if (tpCfg?.use && tpCfg.tpGridPct?.length) {
              await cancelStopOrders(symbol, { onlyTP: true }); // видаляємо тільки TP

              for (let i = 0; i < tpCfg.tpGridPct.length; i++) {
                const pct = Number(tpCfg.tpGridPct[i]);
                const sizePct = Number(tpCfg.tpGridSizePct?.[i] ?? 0); // у %
                if (!Number.isFinite(pct) || !Number.isFinite(sizePct))
                  continue;

                const tpPrice =
                  side === 'LONG'
                    ? entryPrice * (1 + pct / 100)
                    : entryPrice * (1 - pct / 100);

                const tpQty = tracker.lastSize * (sizePct / 100); // ⬅ частка від розміру

                if (tpQty > 0) {
                  await placeTakeProfit(symbol, side, tpPrice, tpQty);
                  console.log(
                    `🎯 [LIVE] TP set @ ${tpPrice} for ${tpQty.toFixed(
                      3,
                    )} ${symbol}`,
                  );

                  await adjustPosition(symbol, {
                    type: 'TP',
                    price: tpPrice,
                    size: tpQty,
                  });
                }
              }
            }

            console.log(
              `➕ [LIVE] Added ${addQty.toFixed(3)} ${symbol} @ ${price} (adds=${tracker.addsCount}/${sizing.maxAdds})`,
            );

            await addToPosition(symbol, { qty: addQty, price });
          } catch (err) {
            console.error('❌ Add order failed:', err?.message || err);
          }
        } else {
          tracker.addsCount += 1;
          tracker.lastSize = size + addQty;
          addTracker.set(symbol, tracker);
          console.log(
            `➕ [PAPER] Add simulated @ ${price}, qty=${addQty.toFixed(
              3,
            )} (adds=${tracker.addsCount}/${sizing.maxAdds})`,
          );

          await addToPosition(symbol, { qty: addQty, price });
        }
      } else {
        // просто синхронізуємо lastSize — щоб не «плило» після часткових виконань
        addTracker.set(symbol, {
          lastSize: size,
          addsCount: tracker.addsCount,
        });
      }
    }
  }
}
