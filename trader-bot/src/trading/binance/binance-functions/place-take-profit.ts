import logger from '../../../utils/db-logger';
import { adjustPrice } from './adjust-price';
import { adjustQuantity } from './adjust-quantity';
import { client } from './client';
import { getSymbolFilters } from './get-symbol-filters';
import { oppositeOrderSide } from './opposite-order-side';
import type { OrderSide, Side } from './types';

export async function placeTakeProfit(
  symbol: string,
  positionSide: Side | OrderSide,
  tpPrice: number | string,
  quantity: number | string,
): Promise<any | null> {
  try {
    const filters = await getSymbolFilters(symbol);
    const closeSide = oppositeOrderSide(positionSide);
    const qty = adjustQuantity(filters, quantity);
    const price = adjustPrice(filters, tpPrice);

    if (!qty || Number(qty) <= 0)
      throw new Error(`TP qty too small for ${symbol}`);
    if (!price || Number(price) <= 0)
      throw new Error(`TP price invalid for ${symbol}`);

    return await client.futuresOrder({
      symbol,
      side: closeSide,
      type: 'TAKE_PROFIT_MARKET',
      stopPrice: price,
      quantity: qty,
      reduceOnly: true,
    });
  } catch (err: any) {
    logger.error(
      `❌ placeTakeProfit failed for ${symbol}:`,
      err?.message || err,
    );
    return null;
  }
}
