import type { UserTrade } from '../../../types/index.ts';
import logger from '../../../utils/db-logger.ts';
import { client } from './client.ts';

export async function getUserTrades(
  symbol: string,
  options: { limit?: number; fromId?: number } = {},
): Promise<Array<UserTrade>> {
  try {
    const res: any[] = await client.futuresUserTrades({
      symbol,
      limit: options.limit || 50,
      fromId: options.fromId,
    });

    return res.map((t) => ({
      id: t.id,
      orderId: t.orderId,
      symbol: t.symbol,
      side: t.side,
      price: Number(t.price),
      qty: Number(t.qty),
      realizedPnl: Number(t.realizedPnl),
      marginAsset: t.marginAsset,
      time: t.time,
    }));
  } catch (err: any) {
    logger.error(`❌ getUserTrades failed for ${symbol}:`, err?.message || err);
    return [];
  }
}
