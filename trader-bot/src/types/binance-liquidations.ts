// Binance liquidation event types
import type { BinanceSide } from './common';

export interface ForceOrderOrder {
  s: string; // symbol
  S: BinanceSide; // BUY / SELL (who got liquidated)
  q: string; // qty
  p?: string; // price
  ap?: string; // average price
  T?: number; // order time (ms)
}

export interface ForceOrderEvent {
  e: 'forceOrder';
  E?: number;
  o: ForceOrderOrder;
}
