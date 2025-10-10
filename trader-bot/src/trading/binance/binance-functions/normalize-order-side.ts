import type { OrderSide, Side } from './types';

export function normalizeOrderSide(side: Side | OrderSide): OrderSide {
  const s = String(side).toUpperCase();
  if (s === 'LONG' || s === 'BUY') return 'BUY';
  if (s === 'SHORT' || s === 'SELL') return 'SELL';
  throw new Error(`Unknown side: ${side as string}`);
}
