import logger from '../../../utils/db-logger';
import { client } from './client';

export async function getFuturesBalance(asset = 'USDT'): Promise<number> {
  try {
    const balances = await client.futuresAccountBalance();
    const v = balances.find((b: any) => b.asset === asset)?.balance;
    return Number(v) || 0;
  } catch (err: any) {
    logger.error(
      `❌ getFuturesBalance failed for ${asset}:`,
      err?.message || err,
    );
    return 0;
  }
}
