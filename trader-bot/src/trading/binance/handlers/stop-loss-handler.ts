import type { IPosition } from 'crypto-trader-db';
import type { OrderTradeUpdateEvent } from '../../../types/index';
import logger from '../../../utils/db-logger';
import { updateStopPrice, updateTakeProfits } from '../../core/history-store';
import { cancelAllOrders } from '../binance-functions/index';
import { getCtx, maybeFinalizeClose } from '../helpers/close-context';
import { getAndClearAgg } from '../helpers/fill-aggregator';
import { forceCloseIfLeftover } from '../helpers/force-close';
import { calcFillPnl, n, sumTpRealizedPnl } from '../helpers/pnl-calculator';

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * Handle STOP_MARKET order fill (stop-loss)
 */
export async function handleStopLoss(
  m: OrderTradeUpdateEvent,
  pos: IPosition | null,
): Promise<void> {
  const o = m.o;
  const symbol = o.s;
  const lastPx = Number(o.L);

  logger.info(`🛑 ${symbol}: Stop-loss triggered`);

  if (!pos) {
    logger.warn(
      `⚠️ ${symbol}: FILLED STOP_MARKET but no OPEN position in DB. Skipping DB close; cleaning leftovers only.`,
    );
    await cancelAllOrders(symbol);
    await forceCloseIfLeftover(symbol);
    return;
  }

  // Update stop price as "filled"
  try {
    await updateStopPrice(symbol, lastPx, 'FILLED');
  } catch (err) {
    logger.error(`❌ ${symbol}: failed to update stop price:`, errMsg(err));
  }

  // Get aggregated fill quantity and average price
  const agg = getAndClearAgg(o.i);
  const slFillQty = agg?.qty || n(o.z) || n(o.q) || n(o.l);
  const avgPx = n((o as any).ap) || (agg && agg.avgPx > 0 ? agg.avgPx : lastPx);

  const slDelta = calcFillPnl(
    pos.entryPrice as number,
    avgPx,
    slFillQty,
    pos.side as any,
  );

  // Total realized from TP so far
  const realizedFromTP = n(sumTpRealizedPnl(pos));

  logger.info(
    `🧮 ${symbol}: SL PnL parts — realizedFromTP=${realizedFromTP}, slDelta=${slDelta}, slQty=${slFillQty}, entry=${Number(pos.entryPrice) || 0}, avgPx=${avgPx}`,
  );

  // Store close context but don't close position until flat
  const ctx = getCtx(symbol, Number(pos.entryPrice) || 0, pos.side as any);
  ctx.tp = realizedFromTP;
  ctx.sl += n(slDelta);

  // Try to save current TPs (to not lose fills)
  try {
    await updateTakeProfits(
      symbol,
      Array.isArray(pos.takeProfits)
        ? pos.takeProfits.map((t) => ({ ...(t as any) }))
        : [],
      Number(pos.entryPrice) || 0,
      'SL_FILLED',
    );
  } catch (e) {
    logger.warn(
      `⚠️ ${symbol}: failed to persist TPs before SL close:`,
      errMsg(e),
    );
  }

  // Cancel remaining orders and close tail if any
  try {
    await cancelAllOrders(symbol);
  } catch {}
  await forceCloseIfLeftover(symbol);

  // If position is already flat, finalize; otherwise wait for MARKET event
  await maybeFinalizeClose(symbol);
}
