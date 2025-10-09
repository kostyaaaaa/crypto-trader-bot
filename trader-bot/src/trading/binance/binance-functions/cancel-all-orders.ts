import logger from '../../../utils/db-logger.ts';
import { client } from './client.ts';

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
