import logger from '../../../utils/db-logger.ts';
import { client } from './client.ts';
import type { FuturesPositionRisk } from './types.ts';

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
