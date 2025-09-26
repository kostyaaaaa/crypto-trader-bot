// core/historyStore.js
import { saveDoc, loadDocs, updateDoc } from '../../storage/storage.js';
import { getPosition } from '../binance/binance.js';
import { notifyTrade } from '../../utils/notify.js';

const COLLECTION = 'positions';

const KEY_ADJUSTMENT_TYPES = new Set([
  'OPEN',
  'ADD',
  'SL_SET',
  'SL_UPDATE',
  'TP_SET',
  'TP_UPDATE',
  'TP_HIT',
  'CLOSE',
]);

// Допоміжне: дістати останню OPEN по символу
export async function getOpenPosition(symbol) {
  const db = await loadDocs(COLLECTION, symbol);
  return db.find((p) => p.symbol === symbol && p.status === 'OPEN') || null;
}

// Відкрити нову позицію
export async function openPosition(
  symbol,
  {
    side,
    entryPrice,
    size,
    stopPrice,
    takeProfits,
    trailingCfg,
    analysis,
    strategyMeta,
  },
) {
  const pos = await getOpenPosition(symbol);
  if (pos) return pos;

  const newPos = {
    symbol,
    side,
    entryPrice,
    size, // ⚠️ це НОТІОНАЛ ($)
    openedAt: Date.now(),
    status: 'OPEN',

    // SL / TP
    stopPrice: stopPrice ?? null,
    initialStopPrice: stopPrice ?? null,
    takeProfits: (takeProfits || []).map((tp) => ({
      price: tp.price,
      sizePct: tp.sizePct ?? tp.size ?? 100,
      filled: false,
    })),
    initialTPs: (takeProfits || []).map((tp) => ({ ...tp })),

    // trailing
    trailing: trailingCfg
      ? {
          active: false,
          startAfterPct: trailingCfg.startAfterPct,
          trailStepPct: trailingCfg.trailStepPct,
          anchor: null,
        }
      : null,

    adds: [],
    adjustments: [],

    analysisRef: analysis
      ? {
          analysisId: analysis._id,
          bias: analysis.bias,
          scores: analysis.scores,
          modules: analysis.modules,
        }
      : null,

    meta: {
      leverage: strategyMeta?.leverage ?? null,
      riskPct: strategyMeta?.riskPct ?? null,
      strategyName: strategyMeta?.strategyName ?? null,
      openedBy: 'BOT',
    },
  };

  await saveDoc(COLLECTION, newPos);
  return newPos;
}

// Долив
export async function addToPosition(symbol, { qty, price }) {
  const pos = await getOpenPosition(symbol);
  if (!pos) return null;

  const effectivePrice = price || pos.entryPrice || 0;
  const addNotional = qty * effectivePrice;

  return await updateDoc(
    COLLECTION,
    { _id: pos._id },
    {
      $inc: { size: addNotional }, // нотіонал ↑
      $push: { adds: { qty, price: effectivePrice, ts: Date.now() } },
    },
  );
}

// Оновлення стопів/тейків (історія)
export async function adjustPosition(
  symbol,
  { type, price, size, tps, reason },
) {
  if (!KEY_ADJUSTMENT_TYPES.has(type)) {
    // Ignore non-key adjustment types
    return await getOpenPosition(symbol);
  }

  const pos = await getOpenPosition(symbol);
  if (!pos) return null;

  const ts = Date.now();
  let newAdjustments = pos.adjustments ? [...pos.adjustments] : [];

  // Normalize adjustment entry
  const newAdjustment = { type, ts };
  if (price !== undefined) newAdjustment.price = price;
  if (size !== undefined) newAdjustment.size = size;
  if (tps !== undefined) newAdjustment.tps = tps;
  if (reason !== undefined) newAdjustment.reason = reason;

  // For types that should only keep latest version (SL_UPDATE, TP_UPDATE), replace last one if exists
  if (type === 'SL_UPDATE' || type === 'TP_UPDATE') {
    const idx = newAdjustments.findIndex((adj) => adj.type === type);
    if (idx !== -1) {
      newAdjustments[idx] = newAdjustment;
    } else {
      newAdjustments.push(newAdjustment);
    }
  } else {
    // For other key types, just append
    newAdjustments.push(newAdjustment);
  }

  // Limit adjustments to last 20 entries
  if (newAdjustments.length > 20) {
    newAdjustments.splice(0, newAdjustments.length - 20);
  }

  await updateDoc(
    COLLECTION,
    { _id: pos._id },
    { $set: { adjustments: newAdjustments } },
  );

  return {
    ...pos,
    adjustments: newAdjustments,
  };
}

// Закриття (додаємо closedBy)
export async function closePositionHistory(
  symbol,
  { finalPnl = null, closedBy = 'UNKNOWN' } = {},
) {
  const pos = await getOpenPosition(symbol);
  if (!pos) return null;

  await updateDoc(
    COLLECTION,
    { _id: pos._id },
    {
      $set: {
        status: 'CLOSED',
        closedAt: Date.now(),
        finalPnl,
        closedBy,
      },
    },
  );

  // ⬅️ повертаємо оновлений об’єкт
  return {
    ...pos,
    status: 'CLOSED',
    closedAt: Date.now(),
    finalPnl,
    closedBy,
  };
}

// Історія
export async function getHistory(symbol, limit = 50) {
  return await loadDocs(COLLECTION, symbol, limit);
}

// Reconcile local open positions with Binance live positions
export async function reconcilePositions() {
  const all = await loadDocs(COLLECTION);
  const openPositions = all.filter((p) => p.status === 'OPEN');
  const closed = [];
  for (const pos of openPositions) {
    try {
      const live = await getPosition(pos.symbol);
      if (!live || Number(live.positionAmt) === 0) {
        const c = await closePositionHistory(pos.symbol, {
          closedBy: 'DESYNC',
        });
        if (c) {
          closed.push(c);
          await notifyTrade(c, 'CLOSED');
        }
      } else {
        const liveSize = Math.abs(Number(live.positionAmt));
        const storedSize = pos.size || 0;

        if (liveSize > 0 && liveSize < storedSize) {
          // Calculate proportion filled
          const filledNotional = storedSize - liveSize;

          // Mark TPs as filled proportionally
          let remainingFill = filledNotional;
          const updatedTps = pos.takeProfits.map((tp) => {
            if (tp.filled) return tp;
            const tpNotional = (tp.sizePct / 100) * storedSize;
            if (remainingFill >= tpNotional) {
              remainingFill -= tpNotional;
              return { ...tp, filled: true };
            } else {
              return tp; // leave unfilled for partials
            }
          });

          await updateTakeProfits(
            pos.symbol,
            updatedTps,
            pos.entryPrice,
            'RECONCILE',
          );
        }
      }
    } catch (err) {
      console.error(
        `⚠️ reconcilePositions failed for ${pos.symbol}:`,
        err.message,
      );
    }
  }
  return closed;
}

export async function updateStopPrice(symbol, price, reason) {
  const pos = await getOpenPosition(symbol);
  if (!pos) return null;

  if (pos.stopPrice === price) {
    // no change, skip update
    return pos;
  }

  const ts = Date.now();
  let newAdjustments = pos.adjustments ? [...pos.adjustments] : [];

  // Normalize new adjustment
  const newAdjustment = { type: 'SL_UPDATE', price, reason, ts };

  // Find last SL_UPDATE adjustment
  const lastSLIdx = newAdjustments
    .map((adj) => adj.type)
    .lastIndexOf('SL_UPDATE');
  if (lastSLIdx !== -1) {
    const lastSL = newAdjustments[lastSLIdx];
    const timeDiff = ts - lastSL.ts;
    const priceDiffPct = Math.abs(price - lastSL.price) / (lastSL.price || 1);

    if (timeDiff <= 30000 || priceDiffPct < 0.001) {
      // Overwrite last SL_UPDATE
      newAdjustments[lastSLIdx] = newAdjustment;
    } else {
      // Append new SL_UPDATE
      newAdjustments.push(newAdjustment);
    }
  } else {
    newAdjustments.push(newAdjustment);
  }

  // Limit adjustments to last 20 entries
  if (newAdjustments.length > 20) {
    newAdjustments.splice(0, newAdjustments.length - 20);
  }

  await updateDoc(
    COLLECTION,
    { _id: pos._id },
    {
      $set: { stopPrice: price, adjustments: newAdjustments },
    },
  );

  return {
    ...pos,
    stopPrice: price,
    adjustments: newAdjustments,
  };
}

export async function updateTakeProfits(symbol, tps, baseEntry, reason) {
  const pos = await getOpenPosition(symbol);
  if (!pos) return null;

  // Compare new TPs with current to avoid unnecessary update
  const currentTps = pos.takeProfits || [];
  const tpsEqual =
    currentTps.length === tps.length &&
    currentTps.every((tp, i) => {
      const newTp = tps[i];
      return (
        tp.price === newTp.price &&
        tp.sizePct === newTp.sizePct &&
        tp.filled === newTp.filled
      );
    });
  if (tpsEqual) {
    return pos; // no change, skip update
  }

  const ts = Date.now();
  let newAdjustments = pos.adjustments ? [...pos.adjustments] : [];

  // Normalize new adjustment
  const newAdjustment = { type: 'TP_UPDATE', tps, baseEntry, reason, ts };

  // Find last TP_UPDATE adjustment
  const lastTPIdx = newAdjustments
    .map((adj) => adj.type)
    .lastIndexOf('TP_UPDATE');
  if (lastTPIdx !== -1) {
    const lastTP = newAdjustments[lastTPIdx];
    // Replace last TP_UPDATE with new one
    newAdjustments[lastTPIdx] = newAdjustment;
  } else {
    newAdjustments.push(newAdjustment);
  }

  // Limit adjustments to last 20 entries
  if (newAdjustments.length > 20) {
    newAdjustments.splice(0, newAdjustments.length - 20);
  }

  await updateDoc(
    COLLECTION,
    { _id: pos._id },
    {
      $set: { takeProfits: tps, adjustments: newAdjustments },
    },
  );

  return {
    ...pos,
    takeProfits: tps,
    adjustments: newAdjustments,
  };
}
