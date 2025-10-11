// src/trading/core/historyStore.ts
import type {
  IAdjustment,
  IAnalysis,
  IPosition,
  ITakeProfit,
} from 'crypto-trader-db';
import { Types } from 'mongoose';
import { createPosition, getPositions, updatePosition } from '../../api';
import logger from '../../utils/db-logger';
import { notifyTrade } from '../../utils/notify';
import { getPosition, getUserTrades } from '../binance/binance-functions/index';

export type Side = 'LONG' | 'SHORT';

export interface IAdd {
  qty: number;
  price: number;
  ts: number;
}

export type ExecutionKind = 'OPEN' | 'ADD' | 'TP' | 'SL' | 'CLOSE';

export interface IExecution {
  kind: ExecutionKind;
  ts: number;
  price: number;
  qty: number;
  fee: number;
  pnl: number;
  cumPnl?: number;
}

function round(n: number, p = 6): number {
  const m = Math.pow(10, p);
  return Math.round((Number(n) || 0) * m) / m;
}
function nowTs(): number {
  return Date.now();
}
function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

const COLLECTION = 'positions' as const;

const KEY_ADJUSTMENT_TYPES = new Set<IAdjustment['type']>([
  'OPEN',
  'ADD',
  'SL_SET',
  'SL_UPDATE',
  'TP_SET',
  'TP_UPDATE',
  'TP_HIT',
  'SL_HIT',
  'CLOSE',
]);

// Helper for accessing Mongo _id field
type WithMongoId<T> = T & { _id: Types.ObjectId | string };
const asWithId = <T extends object>(x: T): WithMongoId<T> =>
  x as WithMongoId<T>;

// ===== API =====

// Дістати останню OPEN по символу
export async function getOpenPosition(
  symbol: string,
): Promise<IPosition | null> {
  const docs = await getPositions(symbol, 1);
  return docs.find((p) => p.symbol === symbol && p.status === 'OPEN') || null;
}

interface OpenPositionArgs {
  side: Side;
  entryPrice: number;
  size: number; // $-нотіонал
  stopPrice?: number | null;
  takeProfits: Array<{
    price: number;
    sizePct: number;
    filled?: boolean;
    pct?: number;
  }>;
  trailingCfg?: { startAfterPct: number; trailStepPct: number } | null;
  analysis?: IAnalysis | null; // ObjectId | string | null
  strategyMeta?: {
    leverage?: number | null;
    riskPct?: number | null;
    strategyName?: string | null;
  };
}

// Відкрити нову позицію (новий документ завжди)
export async function openPosition(
  symbol: string,
  args: OpenPositionArgs,
): Promise<IPosition> {
  const {
    side,
    entryPrice,
    size,
    stopPrice = null,
    takeProfits,
    trailingCfg,
    analysis,
    strategyMeta,
  } = args;

  const newPos: IPosition = {
    symbol,
    side,
    entryPrice,
    size,
    openedAt: new Date(),
    status: 'OPEN',
    stopPrice,
    initialStopPrice: stopPrice,
    takeProfits: (takeProfits || []).map((tp) => ({
      price: Number(tp.price),
      sizePct: Number(
        tp.sizePct ?? (tp as unknown as { size?: number }).size ?? 100,
      ),
      filled: Boolean(tp.filled ?? false),
    })),
    initialTPs: (takeProfits || []).map((tp) => ({
      price: Number(tp.price),
      sizePct: Number(
        tp.sizePct ?? (tp as unknown as { size?: number }).size ?? 100,
      ),
    })),
    trailing: trailingCfg
      ? {
          active: false,
          startAfterPct: Number(trailingCfg.startAfterPct),
          trailStepPct: Number(trailingCfg.trailStepPct),
          anchor: null,
        }
      : null,
    realizedPnl: 0,
    fees: 0,
    executions: [] as IExecution[],
    adds: [] as IAdd[],
    adjustments: [] as IAdjustment[],
    analysis: analysis ?? null,
    meta: {
      leverage: (strategyMeta?.leverage as number | null) ?? null,
      riskPct: (strategyMeta?.riskPct as number | null) ?? null,
      strategyName: strategyMeta?.strategyName ?? null,
      openedBy: 'BOT',
    },
  };

  try {
    await createPosition(newPos);
  } catch (e: unknown) {
    logger.error(`❌ openPosition save failed for ${symbol}: ${errMsg(e)}`);
  }

  return newPos;
}

interface AddToPositionArgs {
  qty: number;
  price?: number; // ціна додавання (якщо немає — беремо entryPrice)
  fee?: number; // USDT
}

// Долив (ADD)
export async function addToPosition(
  symbol: string,
  { qty, price, fee = 0 }: AddToPositionArgs,
): Promise<boolean> {
  const pos = await getOpenPosition(symbol);
  if (!pos) return false;

  const effectivePrice = Number.isFinite(Number(price))
    ? Number(price)
    : Number(pos.entryPrice) || 0;

  const q = Number(qty) || 0;
  const addNotional = round(q * effectivePrice, 8);
  const ts = nowTs();
  const feeNum = Number(fee) || 0;

  const exec: IExecution = {
    kind: 'ADD',
    ts,
    price: effectivePrice,
    qty: q,
    fee: feeNum,
    pnl: 0,
  };

  const posId = String(asWithId(pos)._id);

  // Update position with add data
  const newSize = (pos.size || 0) + addNotional;
  const newFees = (pos.fees || 0) + feeNum;
  const newAdds = [
    ...(pos.adds || []),
    {
      size: addNotional,
      fees: feeNum,
      qty: q,
      price: effectivePrice,
      ts,
    },
  ];
  const newExecutions = [...(pos.executions || []), exec];

  await updatePosition(posId, {
    size: newSize,
    fees: newFees,
    adds: newAdds,
    executions: newExecutions,
    updatedAt: new Date(),
  });

  return true;
}

interface AdjustArgs {
  type: IAdjustment['type'];
  price?: number;
  size?: number; // для TP/SL fill — кількість (qty) у монеті
  tps?: Array<{ price: number; sizePct: number }>;
  reason?: string;
  fee?: number;
}

// Оновлення/фіксація історії (SL/TP/OPEN/CLOSE/…)
export async function adjustPosition(
  symbol: string,
  { type, price, size, tps, reason, fee = 0 }: AdjustArgs,
): Promise<IPosition | null> {
  if (!KEY_ADJUSTMENT_TYPES.has(type)) {
    return await getOpenPosition(symbol);
  }
  const pos = await getOpenPosition(symbol);
  if (!pos) return null;

  const ts = nowTs();
  const newAdjustments: IAdjustment[] = pos.adjustments
    ? [...pos.adjustments]
    : [];
  const newAdj: IAdjustment = { type, ts };
  if (price !== undefined) newAdj.price = Number(price);
  if (size !== undefined) newAdj.size = Number(size);
  if (tps !== undefined) newAdj.tps = tps;
  if (reason !== undefined) newAdj.reason = reason;
  newAdjustments.push(newAdj);
  if (newAdjustments.length > 20) {
    newAdjustments.splice(0, newAdjustments.length - 20);
  }

  const FILL_TYPES = new Set(['TP_HIT', 'SL_HIT', 'CLOSE'] as const);
  const hasExecInputs =
    FILL_TYPES.has(
      type as typeof FILL_TYPES extends Set<infer U> ? U : never,
    ) &&
    Number.isFinite(Number(price)) &&
    Number.isFinite(Number(size)) &&
    Number(size) > 0;

  let update: Record<string, unknown> = {
    $set: { adjustments: newAdjustments },
  };

  if (hasExecInputs) {
    const dir = pos.side === 'LONG' ? 1 : -1;
    const execQty = Number(size);
    const execPrice = Number(price);
    const pnl = round(dir * (execPrice - pos.entryPrice) * execQty, 8);
    const execFee = Number(fee) || 0;

    // Зменшуємо cost-basis "size" (зберігаємо $-нотіонал за entryPrice)
    const reduceNotional = round(pos.entryPrice * execQty, 8);
    const newSize = Math.max(0, round((pos.size || 0) - reduceNotional, 8));

    const exec: IExecution = {
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
      },
      $inc: {
        realizedPnl: pnl,
        fees: execFee,
      },
      $push: {
        executions: exec,
      },
    } as Record<string, unknown>;

    // Якщо закрили повністю — додамо технічний CLOSE
    if (newSize === 0 && type !== 'CLOSE') {
      const finalClose: IExecution = {
        kind: 'CLOSE',
        ts,
        price: execPrice,
        qty: 0,
        fee: 0,
        pnl: 0,
        cumPnl: round((pos.realizedPnl || 0) + pnl, 8),
      };
      (update.$push as { executions: unknown }) = {
        executions: { $each: [exec, finalClose] },
      };
      (update.$set as Record<string, unknown>) = {
        ...(update.$set as Record<string, unknown>),
        finalPnl: round((pos.realizedPnl || 0) + pnl, 8),
        closedAt: new Date(),
        closedBy: exec.kind, // TP або SL
      };
    }
  }

  const posId = String(asWithId(pos)._id);

  // Prepare update data
  const updateData: Partial<IPosition> = {
    adjustments: newAdjustments,
  };

  // Handle $set fields
  const updateSet = (update as any).$set;
  if (updateSet) {
    if (updateSet.stopPrice !== undefined)
      updateData.stopPrice = updateSet.stopPrice;
    if (updateSet.takeProfits !== undefined)
      updateData.takeProfits = updateSet.takeProfits;
    if (updateSet.status !== undefined) updateData.status = updateSet.status;
    if (updateSet.closedAt !== undefined)
      updateData.closedAt = updateSet.closedAt;
    if (updateSet.closedBy !== undefined)
      updateData.closedBy = updateSet.closedBy;
    if (updateSet.finalPnl !== undefined)
      updateData.finalPnl = updateSet.finalPnl;
    if (updateSet.size !== undefined) updateData.size = updateSet.size;
  }

  // Handle $inc fields
  const updateInc = (update as any).$inc;
  if (updateInc) {
    if (updateInc.realizedPnl !== undefined)
      updateData.realizedPnl = (pos.realizedPnl || 0) + updateInc.realizedPnl;
    if (updateInc.fees !== undefined)
      updateData.fees = (pos.fees || 0) + updateInc.fees;
  }

  // Handle $push fields
  const updatePush = (update as any).$push;
  if (updatePush) {
    if (updatePush.executions) {
      const execToPush = (updatePush.executions as any).$each
        ? (updatePush.executions as any).$each
        : [updatePush.executions];
      updateData.executions = [...(pos.executions || []), ...execToPush];
    }
  }

  await updatePosition(posId, updateData);
  return { ...pos, ...updateData };
}

// Закриття позиції з історією
export async function closePositionHistory(
  symbol: string,
  { closedBy = 'UNKNOWN' }: { closedBy?: string } = {},
): Promise<IPosition | null> {
  const pos = await getOpenPosition(symbol);
  if (!pos) return null;

  let finalPnl = Number(pos.realizedPnl || 0);

  // Legacy-фолбек — якщо PnL не накопичився
  if (!Number.isFinite(finalPnl) || Math.abs(finalPnl) < 1e-9) {
    try {
      type UserTrade = {
        time?: number;
        T?: number;
        realizedPnl?: number | string;
      };
      const trades = (await getUserTrades(symbol, {
        limit: 1000,
      })) as UserTrade[];
      const since = pos.openedAt ? new Date(pos.openedAt).getTime() : 0;
      finalPnl = trades
        .filter((t) => (t.time ?? t.T ?? 0) >= since)
        .reduce((sum: number, t) => sum + (Number(t.realizedPnl) || 0), 0);
    } catch (e: unknown) {
      // ignore — залишаємо finalPnl як є
    }
  }

  const posId = String(asWithId(pos)._id);
  const closedAt = new Date();
  const roundedPnl = round(finalPnl, 8);

  await updatePosition(posId, {
    adjustments: pos.adjustments || [],
    status: 'CLOSED',
    closedAt,
    finalPnl: roundedPnl,
    closedBy,
  });

  return {
    ...pos,
    status: 'CLOSED',
    closedAt,
    finalPnl: roundedPnl,
    closedBy,
  };
}

// Історія по символу
export async function getHistory(
  symbol: string,
  limit = 50,
): Promise<IPosition[]> {
  return (await getPositions(symbol, limit)) as IPosition[];
}

// Синхронізація локальних OPEN із live-станом Binance
export async function reconcilePositions(): Promise<IPosition[]> {
  const all = (await getPositions()) as IPosition[];
  const openPositions = all.filter((p) => p.status === 'OPEN');
  const closed: IPosition[] = [];

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
      }
    } catch (err: unknown) {
      logger.error(
        `⚠️ reconcilePositions failed for ${pos.symbol}: ${errMsg(err)}`,
      );
    }
  }
  return closed;
}

// Оновити стоп-ціну
export async function updateStopPrice(
  symbol: string,
  price: number,
  reason?: string,
): Promise<IPosition | null> {
  const pos = await getOpenPosition(symbol);
  if (!pos) return null;

  if (pos.stopPrice === price) return pos;

  const ts = Date.now();
  const newAdjustment: IAdjustment = { type: 'SL_UPDATE', price, reason, ts };
  const newAdjustments = pos.adjustments
    ? [...pos.adjustments, newAdjustment]
    : [newAdjustment];
  if (newAdjustments.length > 20)
    newAdjustments.splice(0, newAdjustments.length - 20);

  const posId = String(asWithId(pos)._id);

  await updatePosition(posId, {
    adjustments: newAdjustments,
    stopPrice: price,
  });

  return { ...pos, stopPrice: price, adjustments: newAdjustments };
}

export async function updateTakeProfits(
  symbol: string,
  tps: Array<{ price: number; sizePct: number }>,
  _baseEntry?: number,
  reason?: string,
): Promise<IPosition | null> {
  const pos = await getOpenPosition(symbol);
  if (!pos) return null;

  const ts = Date.now();
  const newAdjustment: IAdjustment = { type: 'TP_UPDATE', tps, reason, ts };
  const newAdjustments = pos.adjustments
    ? [...pos.adjustments, newAdjustment]
    : [newAdjustment];
  if (newAdjustments.length > 20)
    newAdjustments.splice(0, newAdjustments.length - 20);

  const mapped: ITakeProfit[] = (tps || []).map((x) => ({
    price: Number(x.price),
    sizePct: Number(x.sizePct),
    filled: false,
  }));

  const posId = String(asWithId(pos)._id);

  await updatePosition(posId, {
    adjustments: newAdjustments,
    takeProfits: mapped,
  });

  return { ...pos, takeProfits: mapped, adjustments: newAdjustments };
}
