// core/historyStore.js
import { loadDocs, saveDoc, updateDoc } from '../../storage/storage.js';
import { notifyTrade } from '../../utils/notify.js';
import { getPosition, getUserTrades } from '../binance/binance.js';

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
  const newPos = {
    symbol,
    side,
    entryPrice,
    size,
    openedAt: new Date(),
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
        }
      : null,

    meta: {
      leverage: strategyMeta?.leverage ?? null,
      riskPct: strategyMeta?.riskPct ?? null,
      strategyName: strategyMeta?.strategyName ?? null,
      openedBy: 'BOT',
    },
  };

  // Always insert a new document
  const savedPos = await saveDoc(COLLECTION, newPos);
  if (savedPos?._id) {
    newPos._id = savedPos._id;
  }

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

  // Just append adjustment without merge logic
  newAdjustments.push(newAdjustment);

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
  { closedBy = 'UNKNOWN' } = {},
) {
  const pos = await getOpenPosition(symbol);
  if (!pos) return null;
  const trades = await getUserTrades(symbol, { limit: 100 });

  // знаходимо останній ордер з PnL
  const lastOrderId = [...trades]
    .reverse()
    .find((t) => t.realizedPnl !== 0)?.orderId;

  if (!lastOrderId) return null;

  // агрегуємо всі трейди цього ордера
  const orderTrades = trades.filter((t) => t.orderId === lastOrderId);
  const totalPnl = orderTrades.reduce((sum, t) => sum + t.realizedPnl, 0);
  await updateDoc(
    COLLECTION,
    { _id: pos._id },
    {
      $set: {
        status: 'CLOSED',
        closedAt: new Date(),
        finalPnl: totalPnl,
        closedBy,
      },
    },
  );

  return {
    ...pos,
    status: 'CLOSED',
    closedAt: new Date(),
    finalPnl: totalPnl,
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
          crossOriginIsolated.log(123123);
          await notifyTrade(c, 'CLOSED');
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
  const newAdjustment = { type: 'SL_UPDATE', price, reason, ts };
  const newAdjustments = pos.adjustments
    ? [...pos.adjustments, newAdjustment]
    : [newAdjustment];

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

  const ts = Date.now();
  const newAdjustment = { type: 'TP_UPDATE', tps, baseEntry, reason, ts };
  const newAdjustments = pos.adjustments
    ? [...pos.adjustments, newAdjustment]
    : [newAdjustment];

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
