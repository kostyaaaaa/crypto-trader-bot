import logger from '../../../utils/db-logger';
import { client } from './client';

export async function cancelAllOrders(symbol: string): Promise<any | null> {
  try {
    return await client.futuresCancelAllOpenOrders({ symbol });
  } catch (err: any) {
    logger.error(
      `❌ cancelAllOrders failed for ${symbol}:`,
      err?.message || err,
    );
    return null;
  }
}
