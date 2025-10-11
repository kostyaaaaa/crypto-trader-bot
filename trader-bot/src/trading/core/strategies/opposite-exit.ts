import type { Side } from '../../../types';
import logger from '../../../utils/db-logger';
import {
  cancelStopOrders,
  openMarketOrder,
} from '../../binance/binance-functions/index';
import { getAnaSide, roundQty, TRADE_MODE } from '../helpers/monitor-helpers';
import { adjustPosition } from '../history-store';

interface AnalysisRecord {
  bias?: Side | 'NEUTRAL';
  signal?: Side | 'NEUTRAL';
  time?: string | Date;
  createdAt?: string | Date;
}

/**
 * Check and execute opposite signal exit strategy
 * @returns true if position should be exited, false otherwise
 */
export async function checkOppositeExit(params: {
  symbol: string;
  side: Side;
  liveQty: number;
  price: number;
  oppExitN: number;
  recentAnalyses: AnalysisRecord[];
}): Promise<boolean> {
  const { symbol, side, liveQty, price, oppExitN, recentAnalyses } = params;

  if (oppExitN <= 0) return false;

  const isOpposite = (s: Side | 'NEUTRAL' | null) =>
    side === 'LONG' ? s === 'SHORT' : s === 'LONG';

  const lastN = recentAnalyses.slice(0, oppExitN);
  const allOpposite =
    lastN.length === oppExitN && lastN.every((a) => isOpposite(getAnaSide(a)));

  if (!allOpposite) return false;

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

  // In DB — this is final CLOSE
  try {
    await adjustPosition(symbol, {
      type: 'CLOSE',
      price,
      size: liveQty,
      reason: `EXIT_OPPOSITE x${oppExitN}`,
    });
  } catch {}

  return true;
}
