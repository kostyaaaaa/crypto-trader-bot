// trading/core/monitor.js
import { loadDocs } from '../../storage/storage.js';
import logger from '../../utils/db-logger.js';
import {
  cancelStopOrders,
  openMarketOrder,
  placeStopLoss,
} from '../binance/binance.js';
import { getActivePositions } from './binance-positions-manager.js';
import {
  addToPosition,
  adjustPosition,
  getOpenPosition,
  updateStopPrice,
} from './historyStore.js';

import markPriceHub from './mark-price-hub.js';

// === Mark price from WS hub (no REST) ===
async function getMarkFromHub(symbol) {
  const m = markPriceHub.getMark(symbol);
  if (m && !m.stale) return m.markPrice;
  const first = await markPriceHub.waitForMark(symbol);
  return first?.markPrice ?? null;
}

const TRADE_MODE = process.env.TRADE_MODE || 'paper';

// Нормалізуємо сторону з аналізу: пріоритетно bias, інакше signal
function getAnaSide(a) {
  return (a && (a.bias ?? a.signal)) || null;
}

function roundQty(q) {
  const n = Number(q) || 0;
  return Number(n.toFixed(3)); // adhere to 3-decimal qty granularity
}

export async function monitorPositions({ symbol, strategy }) {
  const openDoc = await getOpenPosition(symbol);
  logger.info(`${symbol}:${!!openDoc} - openDoc`);
  if (!openDoc) return;

  let positions = [];
  try {
    positions = await getActivePositions(symbol);
  } catch {
    return;
  }
  logger.info(`${symbol}:${positions.length} - positions`);
  if (!positions.length) return;

  const price = await getMarkFromHub(symbol);
  logger.info(`${symbol}:${price} - price`);
  if (price == null || !Number.isFinite(Number(price))) {
    logger.warn(
      `⚠️ ${symbol}: no mark price from hub — skip monitor iteration`,
    );
    return;
  }

  // Правило виходу за N послідовних протилежних сигналів: 0 => вимкнено
  const oppExitRaw = strategy?.exits?.oppositeCountExit;
  const oppExitN = Number.isFinite(+oppExitRaw)
    ? Math.max(0, Math.floor(+oppExitRaw))
    : 0;

  // Отримуємо останні аналізи (для перевірки протилежних сигналів та інших фільтрів)
  let lastAnalysis = null;
  let recentAnalyses = [];
  try {
    const docCount = oppExitN > 0 ? oppExitN : 1; // тягнемо щонайменше 1 аналіз
    const analysisDocs = await loadDocs('analysis', symbol, docCount);
    if (Array.isArray(analysisDocs) && analysisDocs.length > 0) {
      // ensure newest-first ordering by time/createdAt
      recentAnalyses = [...analysisDocs].sort((a, b) => {
        const at = new Date(a?.time || a?.createdAt || 0).getTime();
        const bt = new Date(b?.time || b?.createdAt || 0).getTime();
        return bt - at;
      });
      lastAnalysis = recentAnalyses[0];
    }
  } catch {}

  for (let pos of positions) {
    let { side, entryPrice, size: liveQty, orders } = pos;
    liveQty = Math.abs(Number(liveQty));
    if (!Number.isFinite(liveQty) || liveQty <= 0) {
      logger.warn(
        `⚠️ ${symbol}: missing size in position doc — skip trailing/SL updates`,
      );
      continue;
    }
    const dir = side === 'LONG' ? 1 : -1;
    const binanceSide = side === 'LONG' ? 'BUY' : 'SELL';

    // === Exit on consecutive opposite signals (strict last-N) ===
    // Prefer DB stopPrice (ми його точно оновлюємо), fallback до live orders
    let currentSL = Number.isFinite(Number(openDoc?.stopPrice))
      ? Number(openDoc.stopPrice)
      : null;
    if (currentSL == null && Array.isArray(orders)) {
      const slOrder = orders.find(
        (o) =>
          o?.type === 'SL' ||
          o?.type === 'STOP' ||
          /STOP/i.test(String(o?.type || '')),
      );
      if (slOrder) currentSL = Number(slOrder.price) || null;
    }

    logger.info(
      `ℹ️ POS ${symbol}: side=${side} entry=${entryPrice} size=${liveQty} SL=${currentSL ?? '—'}`,
    );

    if (oppExitN > 0) {
      const anaSideFn = getAnaSide;
      const isOppositeToPos = (s) =>
        side === 'LONG' ? s === 'SHORT' : s === 'LONG';

      const lastN = (recentAnalyses || []).slice(0, oppExitN);
      const allOpposite =
        lastN.length === oppExitN &&
        lastN.every((a) => isOppositeToPos(anaSideFn(a)));

      if (allOpposite) {
        logger.info(
          `⏹️ ${symbol}: exit by opposite signals x${oppExitN} (pos=${side})`,
        );
        if (TRADE_MODE === 'live') {
          try {
            await cancelStopOrders(symbol);
          } catch {}
          const closeSide = side === 'LONG' ? 'SELL' : 'BUY';
          try {
            await openMarketOrder(symbol, closeSide, roundQty(liveQty));
          } catch {}
        }
        try {
          await adjustPosition(symbol, {
            type: 'EXIT_OPPOSITE',
            price,
            size: liveQty,
          });
          await adjustPosition(symbol, {
            type: 'TRAIL_INFO',
            note: `Closed by opposite signals x${oppExitN}`,
            price,
            size: liveQty,
          });
        } catch {}
        continue; // не виконуємо інший менеджмент на цій ітерації
      }
    }

    const addsCount = openDoc?.adds?.length || 0;

    /* ===== 1) TRAILING (PnL-anchored) ===== */
    const trailingCfg = strategy?.exits?.trailing;
    logger.info(`${symbol}:${trailingCfg?.use} - trailingCfg?.use`);
    logger.info(`${symbol}:${entryPrice} - entryPrice`);
    if (trailingCfg?.use && entryPrice) {
      try {
        let trailingState = openDoc?.trailing || null;

        const levCfg = Math.max(1, Number(strategy?.capital?.leverage) || 1);
        const levLive = Math.max(
          1,
          Number(pos?.leverage) || Number(openDoc?.meta?.leverage) || levCfg,
        );
        const lev = levLive;

        const startAfterRoiPct = Math.max(
          0,
          Number(trailingCfg.startAfterPct) || 0,
        ); // ROI%
        const gapRoiPct = Math.max(0, Number(trailingCfg.trailStepPct) || 0); // ROI%

        // Обчислюємо ROI% максимально близько до Binance UI
        const priceMovePct = ((price - entryPrice) / entryPrice) * 100 * dir;

        // 1) Перевага біржових полів (як у UI)
        const unreal = Number(pos?.unRealizedProfit);
        const initMarginPos = Number(
          pos?.isolatedMargin ?? pos?.initialMargin ?? NaN,
        );

        // 2) Якщо біржові поля відсутні/некоректні — рахуємо через size + margin
        const qtyFromPos = Number(pos?.size);
        const qtyFromInitialNotional =
          Number.isFinite(Number(openDoc?.initialSizeUsd)) && entryPrice
            ? Number(openDoc.initialSizeUsd) / entryPrice
            : Number.isFinite(Number(openDoc?.size)) && entryPrice
              ? Number(openDoc.size) / entryPrice
              : NaN;

        // В БД немає openDoc.qty. Оцінюємо кількість так:
        // 1) з позиції біржі, 2) з початкового нотіоналу, 3) з поточного liveQty
        const estQty =
          [qtyFromPos, qtyFromInitialNotional, Number(liveQty)].find(
            (v) => Number.isFinite(v) && v > 0,
          ) || 0;

        // допоміжний лог для діагностики
        logger.info(
          `🧮 TRAIL inputs ${symbol}: estQty=${estQty}, entry=${entryPrice}, price=${price}`,
        );

        let marginUsd = Number(openDoc?.marginUsd);
        if (!Number.isFinite(marginUsd) || marginUsd <= 0) {
          const levForMargin = lev;
          if (Number.isFinite(estQty) && estQty > 0 && levForMargin > 0) {
            marginUsd = (estQty * entryPrice) / levForMargin;
          }
        }

        let pnlRoiPct;
        if (
          Number.isFinite(unreal) &&
          Number.isFinite(initMarginPos) &&
          initMarginPos > 0
        ) {
          // Біржовий спосіб
          pnlRoiPct = (unreal / initMarginPos) * 100;
        } else if (
          Number.isFinite(marginUsd) &&
          marginUsd > 0 &&
          Number.isFinite(estQty) &&
          estQty > 0
        ) {
          // Точний розрахунок через PnL/маржа
          const pnlUsd = (price - entryPrice) * dir * estQty;
          pnlRoiPct = (pnlUsd / marginUsd) * 100;
        } else {
          // Апроксимація через ціновий рух * плече
          pnlRoiPct = priceMovePct * lev;
        }

        // Діагностика трейла (можна відключити, якщо шумно)
        logger.info(
          `🔍 TRAIL ${symbol}: side=${side} ROI=${pnlRoiPct.toFixed(2)}% (move=${priceMovePct.toFixed(3)}% * lev=${lev}) start=${startAfterRoiPct}% gap=${gapRoiPct}% active=${!!openDoc?.trailing?.active}`,
        );

        if (!trailingState?.active && pnlRoiPct < startAfterRoiPct) {
          logger.info(
            `⏸️ TRAIL not active: ROI ${pnlRoiPct.toFixed(2)}% < start ${startAfterRoiPct}%`,
          );
        }

        // 1) Активуємо трейл один раз, коли ROI% досяг порогу
        if (!trailingState?.active && pnlRoiPct >= startAfterRoiPct) {
          trailingState = {
            active: true,
            // зберігаємо у ROI%-термінах
            startAfterPct: startAfterRoiPct,
            trailStepPct: gapRoiPct,
            anchorRoiPct: pnlRoiPct, // найкращий ROI% після активації
            lev,
          };
          await adjustPosition(symbol, {
            type: 'TRAIL_ON',
            price,
            size: liveQty,
            meta: { startAfterRoiPct, gapRoiPct, lev },
          });
          logger.info(
            `▶️ TRAIL_ON ${symbol}: activated at ROI=${pnlRoiPct.toFixed(2)}% (start=${startAfterRoiPct}%)`,
          );
        }
        // Persist trailing state to history even якщо ще не рухали SL
        if (trailingState?.active) {
          try {
            const persistPrice = currentSL ?? entryPrice; // не змінюємо stopPrice, якщо його ще не було
            await updateStopPrice(
              symbol,
              persistPrice,
              'TRAIL_ON',
              trailingState,
            );
          } catch {}
        }

        // 2) Тягнемо SL за максимумом ROI у наш бік
        if (trailingState?.active) {
          // оновлюємо максимум ROI тільки у наш бік
          if (pnlRoiPct > (trailingState.anchorRoiPct ?? -Infinity)) {
            trailingState.anchorRoiPct = pnlRoiPct;
          }

          // Цільовий ROI для стопа = (max ROI) - (крок)
          const targetStopRoiPct = Math.max(
            0,
            (trailingState.anchorRoiPct ?? 0) -
              (trailingState.trailStepPct ?? 0),
          );

          // Конвертуємо ROI% у "% руху ціни" через плече
          const useLev = Math.max(1, Number(trailingState.lev || lev) || 1);
          const targetStopPriceMovePct = targetStopRoiPct / useLev;

          // Переводимо у стоп-ціну від entry
          const newStop =
            side === 'LONG'
              ? entryPrice * (1 + targetStopPriceMovePct / 100)
              : entryPrice * (1 - targetStopPriceMovePct / 100);

          const needUpdate =
            (side === 'LONG' && (!currentSL || newStop > currentSL)) ||
            (side === 'SHORT' && (!currentSL || newStop < currentSL));

          if (needUpdate) {
            logger.info(
              `🪢 TRAIL move ${symbol}: SL ${currentSL ?? '—'} → ${newStop.toFixed(6)} (anchorROI=${(trailingState.anchorRoiPct ?? 0).toFixed(2)}%, stepROI=${trailingState.trailStepPct ?? 0}%, lev=${trailingState.lev ?? lev})`,
            );
            if (TRADE_MODE === 'live') {
              await cancelStopOrders(symbol, { onlySL: true }); // TP не чіпаємо
              await placeStopLoss(symbol, side, newStop, roundQty(liveQty));
            }

            await adjustPosition(symbol, {
              type: 'SL',
              price: newStop,
              size: Number(liveQty),
            });
            await updateStopPrice(symbol, newStop, 'TRAIL', trailingState);
          } else {
            logger.info(
              `⛔ TRAIL no move ${symbol}: newStop=${newStop.toFixed(6)} is not better than currentSL=${currentSL ?? '—'}`,
            );
          }
        }
      } catch (e) {
        logger.error(`❌ TRAIL error ${symbol}: ${e?.message || e}`);
      }
    } else {
      if (!trailingCfg?.use)
        logger.info(`🚫 TRAIL disabled in config for ${symbol}`);
      if (!entryPrice)
        logger.warn(`🚫 TRAIL skip: missing entryPrice for ${symbol}`);
    }
    /* ===== 2) DCA / Adds ===== */
    const { sizing } = strategy || {};
    if (sizing && sizing.maxAdds > 0 && entryPrice) {
      // === ROI-based adds (aligned with trailing/TP/SL semantics) ===
      // Trigger when ROI% falls to -addOnAdverseMovePct (negative ROI)
      const roiTrigger = Math.max(0, Number(sizing.addOnAdverseMovePct) || 0);

      // Compute ROI% similar to trailing block (prefer Binance fields)
      const levCfg2 = Math.max(1, Number(strategy?.capital?.leverage) || 1);
      const levLive2 = Math.max(
        1,
        Number(pos?.leverage) || Number(openDoc?.meta?.leverage) || levCfg2,
      );
      const lev2 = levLive2;

      const priceMovePct2 = ((price - entryPrice) / entryPrice) * 100 * dir;
      const unreal2 = Number(pos?.unRealizedProfit);
      const initMargin2 = Number(
        pos?.isolatedMargin ?? pos?.initialMargin ?? NaN,
      );
      const pnlRoiPct2 =
        Number.isFinite(unreal2) &&
        Number.isFinite(initMargin2) &&
        initMargin2 > 0
          ? (unreal2 / initMargin2) * 100
          : priceMovePct2 * lev2;

      // Skip add if latest analysis flips against our side
      const ana = getAnaSide(lastAnalysis);
      if (
        ana &&
        ((side === 'LONG' && ana === 'SHORT') ||
          (side === 'SHORT' && ana === 'LONG'))
      ) {
        // Opposite bias — no averaging down
        // continue to next position iteration
      } else {
        const shouldAdd = pnlRoiPct2 <= -roiTrigger;

        if (shouldAdd && addsCount < sizing.maxAdds) {
          // Fixed-size add based on the FIRST margin (notional = baseMargin * lev)
          const levForNotional = lev2;
          const baseMarginUsd =
            Number(openDoc?.marginUsd) ||
            (Number(openDoc?.initialSizeUsd) && levForNotional > 0
              ? Number(openDoc.initialSizeUsd) / levForNotional
              : 0);

          const mult = Number(sizing.addMultiplier) || 1; // e.g., 0.5 => add 50% of first margin
          const addMarginUsd = baseMarginUsd * mult;
          const addNotionalUsd = addMarginUsd * levForNotional;
          const addQty = addNotionalUsd / price;

          if (Number.isFinite(addQty) && addQty > 0) {
            logger.info(
              `➕ ADD ${symbol}: ROI=${pnlRoiPct2.toFixed(2)}% ≤ -${roiTrigger}% | baseMargin=${baseMarginUsd.toFixed(2)}$ mult=${mult} lev=${levForNotional} -> notional=${addNotionalUsd.toFixed(2)}$ qty=${addQty.toFixed(6)}`,
            );

            if (TRADE_MODE === 'live') {
              try {
                await openMarketOrder(symbol, binanceSide, roundQty(addQty));
                await addToPosition(symbol, { qty: Number(addQty), price });
              } catch {}
            } else {
              await addToPosition(symbol, { qty: Number(addQty), price });
            }
          }
        }
      }
    }
  }
}
