// trading/core/monitor.js
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

// Нормалізуємо сторону з аналізу: пріоритетно bias, інакше signal
function getAnaSide(a) {
  return (a && (a.bias ?? a.signal)) || null;
}

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

// Обчислюємо один референсний TP у % (беремо перший або зважений середній)
// Використовується для простого "TP-anchored trailing"
function getTpReferencePct(tpCfg) {
  if (!tpCfg || !tpCfg.use) return null;
  const arr = Array.isArray(tpCfg.tpGridPct) ? tpCfg.tpGridPct : [];
  if (!arr.length) return null;

  const sizes = Array.isArray(tpCfg.tpGridSizePct) ? tpCfg.tpGridSizePct : null;
  if (sizes && sizes.length === arr.length) {
    const wSum = sizes.reduce((s, v) => s + Number(v || 0), 0) || 1;
    return arr.reduce(
      (acc, p, i) => acc + Number(p || 0) * (Number(sizes[i] || 0) / wSum),
      0,
    );
  }
  return Number(arr[0] || 0);
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
      const anaSide = getAnaSide;
      const isOppositeToPos = (s) =>
        side === 'LONG' ? s === 'SHORT' : s === 'LONG';

      const lastN = (recentAnalyses || []).slice(0, oppExitN);
      const allOpposite =
        lastN.length === oppExitN &&
        lastN.every((a) => isOppositeToPos(anaSide(a)));

      if (allOpposite) {
        console.log(
          `⏹️ ${symbol}: exit by opposite signals x${oppExitN} (pos=${side})`,
        );
        if (TRADE_MODE === 'live') {
          try {
            await cancelStopOrders(symbol);
          } catch {}
          const closeSide = side === 'LONG' ? 'SELL' : 'BUY';
          try {
            await openMarketOrder(
              symbol,
              closeSide,
              Number(liveQty).toFixed(3),
            );
          } catch {}
        }
        try {
          await adjustPosition(symbol, {
            type: 'EXIT_OPPOSITE',
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

    const openDoc = await getOpenHistoryDoc(symbol);
    const addsCount = openDoc?.adds?.length || 0;

    /* ===== 1) TRAILING (TP-anchored) ===== */
    const trailingCfg = strategy?.exits?.trailing;

    // Єдиний простий режим (з БЕЗ зміни назв у конфізі):
    // - startAfterPct: коли увімкнути трейл (як частка від TP, %)
    // - trailStepPct: відстань стопа від "якоря" (як частка від TP, %)
    // Якщо TP не заданий — обидва трактуємо як % від entry (фолбек).

    if (trailingCfg?.use && entryPrice) {
      try {
        let trailingState = openDoc?.trailing || null;

        // 1) Визначаємо референсний TP (% від entry)
        const tpRefPct = getTpReferencePct(strategy?.exits?.tp);

        // 2) Зчитуємо ПОЛЯ зі старими назвами (але інтерпретуємо відносно TP)
        const startAfterPct = Number(trailingCfg.startAfterPct ?? 0);
        const trailStepPct = Number(trailingCfg.trailStepPct ?? 0);

        // 3) Перекладаємо у "відсотки від entry" (якщо TP не заданий — вже у від entry)
        const startAfterEntryPct = tpRefPct
          ? tpRefPct * (startAfterPct / 100)
          : startAfterPct;
        const gapEntryPct = tpRefPct
          ? tpRefPct * (trailStepPct / 100)
          : trailStepPct;

        // напрямок позиції
        const movePct = ((price - entryPrice) / entryPrice) * 100 * dir;

        // 4) Активація трейла один раз при досягненні порогу
        if (!trailingState?.active && movePct >= startAfterEntryPct) {
          trailingState = {
            active: true,
            // зберігаємо вже в перерахованих у % від entry значеннях
            startAfterPct: startAfterEntryPct,
            trailStepPct: gapEntryPct, // лишаємо назву як у конфізі
            anchor: price,
          };
        }

        // 5) Підтягування стопа за "якорем"
        if (trailingState?.active) {
          // оновлюємо anchor лише у бік прибутку
          if (side === 'LONG' && price > (trailingState.anchor || 0)) {
            trailingState.anchor = price;
          }
          if (side === 'SHORT' && price < (trailingState.anchor || Infinity)) {
            trailingState.anchor = price;
          }

          // стоп = anchor ± gapEntryPct
          const newStop =
            side === 'LONG'
              ? trailingState.anchor * (1 - trailingState.trailStepPct / 100)
              : trailingState.anchor * (1 + trailingState.trailStepPct / 100);

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
