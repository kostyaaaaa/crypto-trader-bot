import logger from '../../../utils/db-logger.ts';
import { adjustQuantity } from './adjust-quantity.ts';
import { client } from './client.ts';
import { getSymbolFilters } from './get-symbol-filters.ts';
import { oppositeOrderSide } from './opposite-order-side.ts';
import type {
  FuturesOrderResponse,
  OrderSide,
  Side,
  SymbolFilter,
} from './types.ts';

export async function closePosition(
  symbol: string,
  side: Side | OrderSide,
  quantity: number | string,
): Promise<FuturesOrderResponse | null> {
  try {
    const filters: SymbolFilter[] = await getSymbolFilters(symbol);
    const closeSide: OrderSide = oppositeOrderSide(side);

    // нормалізуємо до числа, квантуємо під stepSize
    const qtyStr = adjustQuantity(filters, Number(quantity));
    if (!qtyStr || Number(qtyStr) <= 0) {
      throw new Error(`Close qty too small for ${symbol}: ${quantity}`);
    }

    const res = await client.futuresOrder({
      symbol,
      side: closeSide,
      type: 'MARKET',
      quantity: qtyStr, // Binance очікує string, ми даємо вже квантоване значення
      reduceOnly: true,
    });

    return res as FuturesOrderResponse;
  } catch (err: any) {
    logger.error(`❌ closePosition failed for ${symbol}:`, err?.message || err);
    return null;
  }
}
