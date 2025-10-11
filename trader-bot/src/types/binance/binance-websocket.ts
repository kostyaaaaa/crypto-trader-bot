// Binance WebSocket event types
import type { OrderStatus, OrderType } from './binance-orders';

export interface OrderTradeUpdateEvent {
  e: 'ORDER_TRADE_UPDATE';
  E?: number; // event time
  T?: number; // transaction time
  o: {
    s: string; // symbol
    X: OrderStatus; // order status
    S: 'BUY' | 'SELL'; // side
    ot: OrderType; // order type
    L?: string | number; // last filled price
    l?: string | number; // last filled qty
    z?: string | number; // cumulative filled qty
    q?: string | number; // order qty
    i: number; // orderId
    n?: string | number; // commission amount
    N?: string; // commission asset
  };
}

export interface AccountUpdateEvent {
  e: 'ACCOUNT_UPDATE';
  [k: string]: unknown;
}

export type UserDataEvent =
  | OrderTradeUpdateEvent
  | AccountUpdateEvent
  | { e: string; [k: string]: unknown };
