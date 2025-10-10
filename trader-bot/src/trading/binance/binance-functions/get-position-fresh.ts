import logger from '../../../utils/db-logger';
import { client } from './client';
import type { FuturesPositionRisk } from './types';

export async function getPositionFresh(
  symbol: string,
): Promise<FuturesPositionRisk | null> {
  try {
    const positions: FuturesPositionRisk[] = await client.futuresPositionRisk();
    return positions.find((p) => p.symbol === symbol) || null;
  } catch (err: any) {
    logger.error(
      `❌ getPositionFresh failed for ${symbol}:`,
      err?.message || err,
    );
    return null;
  }
}
