import logger from '../../../utils/db-logger.ts';
import { adjustQuantity } from './adjust-quantity.ts';
import { client } from './client.ts';
import { getSymbolFilters } from './get-symbol-filters.ts';
import { normalizeOrderSide } from './normalize-order-side.ts';
import type { OrderSide, Side } from './types.ts';

export async function openMarketOrder(
  symbol: string,
  side: Side | OrderSide,
  quantity: number | string,
): Promise<any> {
  try {
    const filters = await getSymbolFilters(symbol);
    const orderSide = normalizeOrderSide(side);
    const qty = adjustQuantity(filters, quantity);
    if (!qty || Number(qty) <= 0)
      throw new Error(`Quantity too small for ${symbol}: ${quantity}`);

    return await client.futuresOrder({
      symbol,
      side: orderSide,
      type: 'MARKET',
      quantity: qty,
    });
  } catch (err: any) {
    logger.error(
      `❌ openMarketOrder failed for ${symbol}:`,
      err?.message || err,
    );
    throw err;
  }
}
