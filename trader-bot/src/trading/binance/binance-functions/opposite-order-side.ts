import { normalizeOrderSide } from './index.ts';
import type { OrderSide, Side } from './types.ts';

export function oppositeOrderSide(side: Side | OrderSide): OrderSide {
  return normalizeOrderSide(side) === 'BUY' ? 'SELL' : 'BUY';
}
