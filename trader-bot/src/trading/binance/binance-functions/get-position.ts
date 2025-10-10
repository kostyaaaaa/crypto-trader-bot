import logger from '../../../utils/db-logger';
import { getPositionRiskCached } from './state';
import type { FuturesPositionRisk } from './types';

export async function getPosition(
  symbol: string,
): Promise<FuturesPositionRisk | null> {
  try {
    const positions = (await getPositionRiskCached()) || [];
    return positions.find((p) => p.symbol === symbol) || null;
  } catch (err: any) {
    logger.error(`❌ getPosition failed for ${symbol}:`, err?.message || err);
    return null;
  }
}
