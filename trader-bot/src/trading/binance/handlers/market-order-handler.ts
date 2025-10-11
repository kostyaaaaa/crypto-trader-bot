import type { OrderTradeUpdateEvent } from '../../../types/index';
import logger from '../../../utils/db-logger';
import { getExistingCtx, maybeFinalizeClose } from '../helpers/close-context';
import { getAndClearAgg } from '../helpers/fill-aggregator';
import { calcFillPnl, n } from '../helpers/pnl-calculator';

/**
 * Handle MARKET order fill (used for closing leftover position)
 */
export async function handleMarketOrder(
  m: OrderTradeUpdateEvent,
): Promise<void> {
  const o = m.o;
  const symbol = o.s;
  const side = o.S;
  const lastPx = Number(o.L);

  logger.info(`✅ Market order filled for ${symbol} (${side})`);

  // If we're in the process of closing after SL, add PnL from leftover
  const ctx = getExistingCtx(symbol);
  if (ctx && !ctx.closed) {
    const agg = getAndClearAgg(o.i);
    const execQty = agg?.qty || n(o.z) || n(o.q) || n(o.l);
    const avgPx =
      n((o as any).ap) || (agg && agg.avgPx > 0 ? agg.avgPx : lastPx);

    if (execQty > 0 && avgPx > 0) {
      const delta = calcFillPnl(ctx.entry, avgPx, execQty, ctx.side as any);
      ctx.leftover += n(delta);
      logger.info(
        `➕ ${symbol}: leftover PnL += ${delta} (qty=${execQty}, avgPx=${avgPx})`,
      );
    }

    await maybeFinalizeClose(symbol);
  }
}
