import type { ISide } from 'crypto-trader-db';

export interface ForceOrderOrder {
  s: string; // symbol
  S: ISide; // BUY / SELL (кого ліквідували)
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

export type DepthLevel = [string, string];

export interface BinanceDepthPartialUpdate {
  b: DepthLevel[]; // bids
  a: DepthLevel[]; // asks

  e?: string; // "depthUpdate" | ...
  E?: number; // event time
  T?: number; // transaction time
  s?: string; // symbol
  U?: number; // first update ID in event
  u?: number; // final update ID in event
  pu?: number; // previous final update ID
  lastUpdateId?: number;
}

export interface OIHistItem {
  symbol: string;
  sumOpenInterest: string;
  sumOpenInterestValue: string;
  timestamp: number;
}

export type BinanceKline = [
  number, // open time (ms)
  string, // open
  string, // high
  string, // low
  string, // close
  string, // volume
  number, // close time
  string, // quote asset volume
  number, // number of trades
  string, // taker buy base volume
  string, // taker buy quote volume
  string, // ignore
];
export type Side = 'LONG' | 'SHORT' | null;
export type BinanceSide = 'BUY' | 'SELL';

export interface LiveOrder {
  type: 'SL' | 'TP';
  price: number | null; // stopPrice або price
  qty: number; // у коінах
  side: BinanceSide; // BUY | SELL
  reduceOnly?: boolean;
}

export interface LiveStateFlat {
  side: Side; // LONG | SHORT | null
  size: number; // у коінах (abs(positionAmt))
  entryPrice: number | null; // entryPrice або null
  leverage: number | null; // pos.leverage або null
  unRealizedProfit: number | null;
  isolatedMargin: number | null;
  initialMargin: number | null;
  markPrice: number | null; // pos.markPrice або null
  orders: LiveOrder[]; // лише SL/TP (без OTHER)
}

export type BinanceFuturesOrderType =
  | 'LIMIT'
  | 'MARKET'
  | 'STOP'
  | 'STOP_MARKET'
  | 'TAKE_PROFIT'
  | 'TAKE_PROFIT_MARKET'
  | 'TRAILING_STOP_MARKET'
  | string; // Binance інколи додає варіації

export interface OpenOrder {
  symbol: string;
  orderId: number;
  clientOrderId: string;

  // ВАЖЛИВО: числові значення приходять як РЯДКИ
  price: string; // часто "0" для STOP_MARKET/TP_MARKET
  stopPrice: string; // ключове поле для SL/TP
  origQty: string;
  executedQty: string;
  cumQuote: string;

  status: string; // NEW / PARTIALLY_FILLED / ...
  timeInForce: 'GTC' | 'IOC' | 'FOK' | 'GTX' | string;
  type: BinanceFuturesOrderType; // поточний тип
  origType?: BinanceFuturesOrderType; // початковий тип (Binance його додає)
  side: BinanceSide; // BUY | SELL
  reduceOnly?: boolean;
  positionSide?: 'BOTH' | 'LONG' | 'SHORT';
  workingType?: 'MARK_PRICE' | 'CONTRACT_PRICE' | string;
  priceProtect?: boolean;
  updateTime?: number;
}
export type UserTrade = {
  id: number; // tradeId з Binance
  orderId: number; // orderId, до якого належить трейд
  symbol: string; // наприклад "ETHUSDT"
  side: 'BUY' | 'SELL'; // напрям виконання трейду
  price: number; // ціна виконання (number)
  qty: number; // кількість (у базовому активі), number
  realizedPnl: number; // реалізований PnL у котируваній валюті (USDT), number
  marginAsset?: string; // зазвичай "USDT"
  time: number; // timestamp у мілісекундах (epoch ms)
};
