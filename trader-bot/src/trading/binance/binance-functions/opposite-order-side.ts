import { normalizeOrderSide } from './index';
import type { OrderSide, Side } from './types';

export function oppositeOrderSide(side: Side | OrderSide): OrderSide {
  return normalizeOrderSide(side) === 'BUY' ? 'SELL' : 'BUY';
}
