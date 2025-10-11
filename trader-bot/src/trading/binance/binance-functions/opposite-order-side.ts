import type { OrderSide, Side } from '../../../types';
import { normalizeOrderSide } from './normalize-order-side';

export function oppositeOrderSide(side: Side | OrderSide): OrderSide {
  return normalizeOrderSide(side) === 'BUY' ? 'SELL' : 'BUY';
}
