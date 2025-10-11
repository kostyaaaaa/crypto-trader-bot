// Binance order-related types
import type { BinanceSide } from './common';

export type BinanceFuturesOrderType =
  | 'LIMIT'
  | 'MARKET'
  | 'STOP'
  | 'STOP_MARKET'
  | 'TAKE_PROFIT'
  | 'TAKE_PROFIT_MARKET'
  | 'TRAILING_STOP_MARKET'
  | string;

export type OrderStatus =
  | 'NEW'
  | 'PARTIALLY_FILLED'
  | 'FILLED'
  | 'CANCELED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'PENDING_CANCEL'
  | 'EXPIRED_IN_MATCH'
  | string;

export type OrderType =
  | 'MARKET'
  | 'STOP_MARKET'
  | 'TAKE_PROFIT_MARKET'
  | 'LIMIT'
  | 'STOP'
  | 'TAKE_PROFIT'
  | string;

export interface OpenOrder {
  symbol: string;
  orderId: number;
  clientOrderId: string;
  price: string; // often "0" for STOP_MARKET/TP_MARKET
  stopPrice: string; // key field for SL/TP
  origQty: string;
  executedQty: string;
  cumQuote: string;
  status: string; // NEW / PARTIALLY_FILLED / ...
  timeInForce: 'GTC' | 'IOC' | 'FOK' | 'GTX' | string;
  type: BinanceFuturesOrderType;
  origType?: BinanceFuturesOrderType;
  side: BinanceSide;
  reduceOnly?: boolean;
  positionSide?: 'BOTH' | 'LONG' | 'SHORT';
  workingType?: 'MARK_PRICE' | 'CONTRACT_PRICE' | string;
  priceProtect?: boolean;
  updateTime?: number;
}

export interface LiveOrder {
  type: 'SL' | 'TP';
  price: number | null; // stopPrice or price
  qty: number; // in coins
  side: BinanceSide; // BUY | SELL
  reduceOnly?: boolean;
}

export type LiveStateOrder = LiveOrder;
