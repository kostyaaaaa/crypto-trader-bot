export interface ForceOrderOrder {
  s: string; // symbol
  S: BinanceSide; // BUY / SELL (кого ліквідували)
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
export type OrderSide = 'BUY' | 'SELL';

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

// Raw live position from exchange/state (before normalization)
export interface LivePosition {
  side: Side; // LONG | SHORT | null
  size: number | string | null; // exchange may return string; we normalize elsewhere
  entryPrice: number | null;
  leverage: number | null;
  unRealizedProfit: number | null;
  isolatedMargin: number | null;
  initialMargin: number | null;
  markPrice: number | null;
}

// Exit plan structure used by binance-positions-manager
export type ExitPlan = {
  sl?: { price: number | null };
  tp?: Array<{ price: number | null; sizePct: number }>;
};

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

// Canonical live state used by get-live-state.ts
export interface LiveState {
  position: LivePosition | null;
  orders: LiveOrder[];
}

export type BinanceFuturesOrderType =
  | 'LIMIT'
  | 'MARKET'
  | 'STOP'
  | 'STOP_MARKET'
  | 'TAKE_PROFIT'
  | 'TAKE_PROFIT_MARKET'
  | 'TRAILING_STOP_MARKET'
  | string;

export interface OpenOrder {
  symbol: string;
  orderId: number;
  clientOrderId: string;

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

export type LiveStateOrder = LiveOrder;

// 2) мінімальний тип позиційного ризику (його просить state.ts/get-live-state.ts)
export interface FuturesPositionRisk {
  symbol: string;
  positionAmt: string;
  entryPrice: string;
  leverage: string;
  unRealizedProfit?: string;
  unrealizedProfit?: string;
  isolatedMargin?: string;
  initialMargin?: string;
  markPrice?: string;
}
// ---- Binance user data stream event types (minimal) ----
export type OrderStatus =
  | 'NEW'
  | 'PARTIALLY_FILLED'
  | 'FILLED'
  | 'CANCELED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'PENDING_CANCEL'
  | 'EXPIRED_IN_MATCH'
  | string; // Binance sometimes adds variants

export type OrderType =
  | 'MARKET'
  | 'STOP_MARKET'
  | 'TAKE_PROFIT_MARKET'
  | 'LIMIT'
  | 'STOP'
  | 'TAKE_PROFIT'
  | string;

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
