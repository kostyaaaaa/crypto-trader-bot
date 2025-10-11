import { PositionModel } from 'crypto-trader-db';
import type { Side } from '../../../types/index';
import logger from '../../../utils/db-logger';
import { notifyTrade } from '../../../utils/notify';
import { closePositionHistory } from '../../core/history-store';
import { cancelAllOrders, getPositionFresh } from '../binance-functions/index';
import { forceCloseIfLeftover } from './force-close';
import { n } from './pnl-calculator';

/**
 * Close context per symbol to accumulate PnL parts until flat
 */
type CloseCtx = {
  entry: number;
  side: Side | null | undefined;
  tp: number; // realized from TPs
  sl: number; // realized from SL
  leftover: number; // realized from forced market close of remainder
  closed?: boolean;
};

const _closeCtx: Map<string, CloseCtx> = new Map();

/**
 * Get or create close context for a symbol
 */
export function getCtx(
  symbol: string,
  entry: number,
  side: Side | null | undefined,
): CloseCtx {
  let c = _closeCtx.get(symbol);
  if (!c) {
    c = { entry, side, tp: 0, sl: 0, leftover: 0 };
    _closeCtx.set(symbol, c);
  }
  return c;
}

/**
 * Get existing close context (if any)
 */
export function getExistingCtx(symbol: string): CloseCtx | undefined {
  return _closeCtx.get(symbol);
}

/**
 * Delete close context
 */
export function deleteCtx(symbol: string): void {
  _closeCtx.delete(symbol);
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * Finalize position close if exchange position is flat
 */
export async function maybeFinalizeClose(symbol: string): Promise<boolean> {
  try {
    const live = (await getPositionFresh(symbol)) as {
      positionAmt?: string;
    } | null;
    const amt = live ? Math.abs(Number(live.positionAmt) || 0) : 0;
    if (amt > 0) return false; // still not flat

    const ctx = _closeCtx.get(symbol);
    if (!ctx || ctx.closed) return false;

    const finalGross = n(ctx.tp) + n(ctx.sl) + n(ctx.leftover);

    const closed = await closePositionHistory(symbol, { closedBy: 'SL' });
    await cancelAllOrders(symbol);
    // extra safety: if exchange already flat, this is a no-op
    await forceCloseIfLeftover(symbol);

    if (closed && Number.isFinite(finalGross)) {
      const pnlToSet = Math.round(n(finalGross) * 1e8) / 1e8;
      await PositionModel.findByIdAndUpdate(
        (closed as any)._id,
        { $set: { finalPnl: pnlToSet } },
        { new: true },
      );
      (closed as any).finalPnl = pnlToSet;
    }

    if (closed) {
      await notifyTrade(closed as any, 'CLOSED');
    }

    ctx.closed = true;
    _closeCtx.delete(symbol);
    return true;
  } catch (e) {
    logger.error(`❌ ${symbol}: finalize close failed:`, errMsg(e));
    return false;
  }
}
