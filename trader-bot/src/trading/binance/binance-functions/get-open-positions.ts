import type { FuturesPositionRisk } from '../../../types';
import logger from '../../../utils/db-logger';
import { client } from './client';

export async function getOpenPositions(): Promise<FuturesPositionRisk[]> {
  try {
    return (await client.futuresPositionRisk()) as FuturesPositionRisk[];
  } catch (err: any) {
    logger.error('❌ getOpenPositions failed:', err?.message || err);
    return [];
  }
}
