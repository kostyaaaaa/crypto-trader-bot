// core/historyStore.js
import { loadDocs, saveDoc, updateDoc } from '../../storage/storage.js';
import { notifyTrade } from '../../utils/notify.js';
import { getPosition, getUserTrades } from '../binance/binance.js';

function round(n, p = 6) {
  const m = Math.pow(10, p);
  return Math.round((Number(n) || 0) * m) / m;
}
function nowTs() {
  return Date.now();
}

const COLLECTION = 'positions';

const KEY_ADJUSTMENT_TYPES = new Set([
  'OPEN',
  'ADD',
  'SL_SET',
  'SL_UPDATE',
  'TP_SET',
  'TP_UPDATE',
  'TP_HIT', // TP executed (partial or full)
  'SL_HIT', // SL executed (partial or full)
  'CLOSE', // manual or final close
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

    realizedPnl: 0, // accumulated realized PnL (USDT)
    fees: 0, // accumulated fees (USDT)
    executions: [], // list of fills (TP/SL/CLOSE/ADD/OPEN)

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
export async function addToPosition(symbol, { qty, price, fee = 0 }) {
  const pos = await getOpenPosition(symbol);
  if (!pos) return null;

  const effectivePrice = price || pos.entryPrice || 0;
  const addNotional = (Number(qty) || 0) * effectivePrice;

  const ts = nowTs();
  const exec = {
    kind: 'ADD',
    ts,
    price: effectivePrice,
    qty: Number(qty) || 0,
    fee: Number(fee) || 0,
    pnl: 0,
  };

  return await updateDoc(
    COLLECTION,
    { _id: pos._id },
    {
      $inc: {
        size: addNotional,
        fees: exec.fee,
      },
      $push: {
        adds: { qty: exec.qty, price: exec.price, ts },
        executions: exec,
      },
      $setOnInsert: { realizedPnl: 0, fees: 0 },
    },
  );
}

// Оновлення стопів/тейків (історія)
export async function adjustPosition(
  symbol,
  { type, price, size, tps, reason, fee = 0 },
) {
  if (!KEY_ADJUSTMENT_TYPES.has(type)) {
    return await getOpenPosition(symbol);
  }

  const pos = await getOpenPosition(symbol);
  if (!pos) return null;

  const ts = nowTs();
  const newAdjustments = pos.adjustments ? [...pos.adjustments] : [];

  const newAdjustment = { type, ts };
  if (price !== undefined) newAdjustment.price = price;
  if (size !== undefined) newAdjustment.size = size;
  if (tps !== undefined) newAdjustment.tps = tps;
  if (reason !== undefined) newAdjustment.reason = reason;

  newAdjustments.push(newAdjustment);
  if (newAdjustments.length > 20) {
    newAdjustments.splice(0, newAdjustments.length - 20);
  }

  // Default update with only adjustments
  let update = { $set: { adjustments: newAdjustments } };

  // If this is a fill-type event, account PnL and reduce live size
  const FILL_TYPES = new Set(['TP_HIT', 'SL_HIT', 'CLOSE']);
  const hasExecInputs =
    FILL_TYPES.has(type) &&
    Number.isFinite(+price) &&
    Number.isFinite(+size) &&
    +size > 0;

  if (hasExecInputs) {
    const dir = pos.side === 'LONG' ? 1 : -1;
    const execQty = Number(size); // executed quantity in coins
    const execPrice = Number(price);

    // PnL by quantity
    const pnl = round(dir * (execPrice - pos.entryPrice) * execQty, 8);
    const execFee = Number(fee) || 0;

    // Reduce cost-basis "size" (we store notional at entry price)
    const reduceNotional = round(pos.entryPrice * execQty, 8);
    const newSize = Math.max(0, round((pos.size || 0) - reduceNotional, 8));

    const exec = {
      kind: type === 'CLOSE' ? 'CLOSE' : type === 'TP_HIT' ? 'TP' : 'SL',
      ts,
      price: execPrice,
      qty: execQty,
      fee: execFee,
      pnl,
      cumPnl: round((pos.realizedPnl || 0) + pnl, 8),
    };

    update = {
      $set: {
        adjustments: newAdjustments,
        status: newSize === 0 ? 'CLOSED' : 'OPEN',
        size: newSize,
        // entryPrice не змінюємо на виході; середня ціна лишається базою
      },
      $inc: {
        realizedPnl: pnl,
        fees: execFee,
      },
      $push: {
        executions: exec,
      },
    };

    // Якщо закрили повністю, додамо технічний CLOSE у executions
    if (newSize === 0 && type !== 'CLOSE') {
      const finalClose = {
        kind: 'CLOSE',
        ts,
        price: execPrice,
        qty: 0,
        fee: 0,
        pnl: 0,
        cumPnl: round((pos.realizedPnl || 0) + pnl, 8),
      };
      update.$push.executions = { $each: [exec, finalClose] };
      update.$set.finalPnl = round((pos.realizedPnl || 0) + pnl, 8);
      update.$set.closedAt = new Date();
      update.$set.closedBy = exec.kind; // TP або SL
    }
  }

  await updateDoc(COLLECTION, { _id: pos._id }, update);

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

  let finalPnl = Number(pos.realizedPnl || 0);

  // If we for some reason didn't accumulate PnL (legacy), fallback to trades aggregation
  if (!Number.isFinite(finalPnl) || Math.abs(finalPnl) < 1e-9) {
    try {
      const trades = await getUserTrades(symbol, { limit: 1000 });
      // беремо всі трейди після openedAt
      const since = pos.openedAt ? new Date(pos.openedAt).getTime() : 0;
      finalPnl = trades
        .filter((t) => (t.time || t.T) >= since)
        .reduce((sum, t) => sum + (Number(t.realizedPnl) || 0), 0);
    } catch {}
  }

  await updateDoc(
    COLLECTION,
    { _id: pos._id },
    {
      $set: {
        status: 'CLOSED',
        closedAt: new Date(),
        finalPnl: round(finalPnl, 8),
        closedBy,
      },
    },
  );

  return {
    ...pos,
    status: 'CLOSED',
    closedAt: new Date(),
    finalPnl: round(finalPnl, 8),
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
