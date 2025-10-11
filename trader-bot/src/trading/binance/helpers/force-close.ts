import logger from '../../../utils/db-logger';
import { getPositionFresh, openMarketOrder } from '../binance-functions/index';

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * Force close any leftover position via market order
 */
export async function forceCloseIfLeftover(symbol: string): Promise<void> {
  try {
    // ⚠️ IMPORTANT: use fresh read to avoid cache staleness right after FILLED
    const live = (await getPositionFresh(symbol)) as {
      positionAmt?: string;
    } | null;
    if (!live) return;

    const amt = Number(live.positionAmt);
    if (!Number.isFinite(amt) || Math.abs(amt) === 0) return;

    const side = amt > 0 ? 'SELL' : 'BUY';
    await openMarketOrder(symbol, side, Math.abs(amt));
    logger.info(`🔧 Forced close leftover ${amt} on ${symbol}`);
  } catch (err) {
    logger.error(`❌ Failed to force close leftover ${symbol}:`, errMsg(err));
  }
}
