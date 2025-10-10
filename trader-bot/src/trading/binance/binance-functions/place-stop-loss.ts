import logger from '../../../utils/db-logger.ts';
import { adjustPrice } from './adjust-price.ts';
import { adjustQuantity } from './adjust-quantity.ts';
import { client } from './client.ts';
import { getSymbolFilters } from './get-symbol-filters.ts';
import { oppositeOrderSide } from './opposite-order-side.ts';
import type { OrderSide, Side } from './types.ts';

export async function placeStopLoss(
  symbol: string,
  positionSide: Side | OrderSide,
  stopPrice: number | string,
  quantity: number | string,
): Promise<any | null> {
  try {
    const filters = await getSymbolFilters(symbol);
    const closeSide = oppositeOrderSide(positionSide);
    const qty = adjustQuantity(filters, quantity);
    const price = adjustPrice(filters, stopPrice);

    if (!qty || Number(qty) <= 0)
      throw new Error(`SL qty too small for ${symbol}`);
    if (!price || Number(price) <= 0)
      throw new Error(`SL price invalid for ${symbol}`);

    return await client.futuresOrder({
      symbol,
      side: closeSide,
      type: 'STOP_MARKET',
      stopPrice: price,
      quantity: qty,
      reduceOnly: true,
    });
  } catch (err: any) {
    logger.error(`❌ placeStopLoss failed for ${symbol}:`, err?.message || err);
    return null;
  }
}
