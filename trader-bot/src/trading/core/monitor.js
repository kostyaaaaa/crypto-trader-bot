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
  getHistory,
  updateStopPrice,
} from './historyStore.js';

import markPriceHub from './mark-price-hub.js';

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

// === Основний моніторинг ===
export async function monitorPositions({ symbol, strategy }) {
  // ⛔ Fast pre-check: if there is no OPEN position in DB, skip any REST calls
  const openDoc = await getOpenHistoryDoc(symbol);
  if (!openDoc) return;

  let positions = [];
  try {
    positions = await getActivePositions(symbol);
  } catch {
    return;
  }

  if (!positions.length) return;

  const price = await getMarkFromHub(symbol);
  console.log(price, 'price', symbol);
  if (price == null) return;

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
    const { side, entryPrice, size: liveQty, orders } = pos;
    const dir = side === 'LONG' ? 1 : -1;
    const binanceSide = side === 'LONG' ? 'BUY' : 'SELL';

    // === Exit on consecutive opposite signals (strict last-N) ===
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

    const currentSL = Array.isArray(orders)
      ? (orders.find((o) => o.type === 'SL')?.price ?? null)
      : null;

    const addsCount = openDoc?.adds?.length || 0;

    /* ===== 1) TRAILING (PnL-anchored) ===== */
    const trailingCfg = strategy?.exits?.trailing;
    console.log(trailingCfg, 'trailingCfg', symbol);

    // Єдиний режим:
    // - startAfterPct: PnL% від entry, з якого активуємо трейл
    // - trailStepPct: PnL% від entry, на якій відстані від max PnL тримаємо SL
    if (trailingCfg?.use && entryPrice) {
      console.log(entryPrice, 'entryPrice', symbol);

      try {
        let trailingState = openDoc?.trailing || null;
        console.log(trailingState, 'trailingState', symbol);

        // Значення у конфізі задаються у ROI% (PnL%)
        const lev = Math.max(1, Number(strategy?.capital?.leverage) || 1);
        const startAfterRoiPct = Math.max(
          0,
          Number(trailingCfg.startAfterPct) || 0,
        ); // ROI%
        const gapRoiPct = Math.max(0, Number(trailingCfg.trailStepPct) || 0); // ROI%

        // Поточний рух ціни (% від entry) та відповідний ROI%
        const priceMovePct = ((price - entryPrice) / entryPrice) * 100 * dir;
        const pnlRoiPct = priceMovePct * lev;

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
          }
        }
      } catch {}
    }
    /* ===== 2) DCA / Adds ===== */
    const { sizing } = strategy || {};
    if (sizing && sizing.maxAdds > 0 && entryPrice) {
      const movePct = (Number(sizing.addOnAdverseMovePct) || 0) / 100;
      const adversePrice =
        side === 'LONG'
          ? entryPrice * (1 - movePct)
          : entryPrice * (1 + movePct);

      const condition =
        (side === 'LONG' && price <= adversePrice) ||
        (side === 'SHORT' && price >= adversePrice);

      // Перевірка аналізу: використовуємо bias (або signal як fallback), щоб було консистентно з рештою логіки
      const ana = getAnaSide(lastAnalysis);
      if (
        ana &&
        ((side === 'LONG' && ana === 'SHORT') ||
          (side === 'SHORT' && ana === 'LONG'))
      ) {
        // Останній аналіз протилежний поточній позиції — долив не робимо
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
            await openMarketOrder(symbol, binanceSide, roundQty(addQty));

            // ❌ SL/TP більше не чіпаємо
            // ⚠️ Запис у ІСТОРІЮ (БД): просто фіксуємо долив
            await addToPosition(symbol, { qty: Number(addQty), price });
          } catch {}
        } else {
          // Симуляція — теж не чіпаємо SL/TP
          await addToPosition(symbol, { qty: Number(addQty), price });
        }
      }
    }
  }
}
