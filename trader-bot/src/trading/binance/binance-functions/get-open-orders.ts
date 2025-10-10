import logger from '../../../utils/db-logger.ts';
import { getOpenOrdersCached } from './state.ts';
import type { OpenOrder } from './types.ts';

export async function getOpenOrders(symbol: string): Promise<OpenOrder[]> {
  try {
    return (await getOpenOrdersCached(symbol)) || [];
  } catch (err: any) {
    logger.error(`❌ getOpenOrders failed for ${symbol}:`, err?.message || err);
    return [];
  }
}
