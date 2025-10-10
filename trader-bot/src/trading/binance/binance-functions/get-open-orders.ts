import logger from '../../../utils/db-logger';
import { getOpenOrdersCached } from './state';
import type { OpenOrder } from './types';

export async function getOpenOrders(symbol: string): Promise<OpenOrder[]> {
  try {
    return (await getOpenOrdersCached(symbol)) || [];
  } catch (err: any) {
    logger.error(`❌ getOpenOrders failed for ${symbol}:`, err?.message || err);
    return [];
  }
}
