import logger from '../../../utils/db-logger.ts';
import { client } from './client.ts';
import type { FuturesPositionRisk } from './types.ts';

export async function getOpenPositions(): Promise<FuturesPositionRisk[]> {
  try {
    return (await client.futuresPositionRisk()) as FuturesPositionRisk[];
  } catch (err: any) {
    logger.error('❌ getOpenPositions failed:', err?.message || err);
    return [];
  }
}
