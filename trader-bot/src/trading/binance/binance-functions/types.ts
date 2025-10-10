// types.ts
export type Side = 'LONG' | 'SHORT' | null;
export type BinanceSide = 'BUY' | 'SELL';

export interface OpenOrder {
  orderId: number;
  symbol: string;
  type: string;
  origType: string;
  price: string;
  stopPrice: string;
  origQty: string;
  side: BinanceSide;
  reduceOnly: boolean;
}

export interface FuturesPositionRisk {
  symbol: string;
  positionAmt: string;
  entryPrice: string;
  leverage?: string;
  unRealizedProfit?: string;
  isolatedMargin?: string;
  initialMargin?: string;
}

export interface SymbolInfo {
  symbol: string;
  filters: SymbolFilter[];
}

export interface LiveStateOrder {
  type: 'SL' | 'TP' | 'OTHER';
  price: number | null;
  qty: number;
  side: BinanceSide;
  reduceOnly: boolean;
}

export interface LiveStatePosition {
  side: Side | null;
  size: number;
  entryPrice: number | null;
  leverage?: number | null;
  unRealizedProfit?: number | null;
  isolatedMargin?: number | null;
  initialMargin?: number | null;
}

export interface LiveState {
  position: LiveStatePosition | null;
  orders: LiveStateOrder[];
}

export type PriceFilter = {
  filterType: 'PRICE_FILTER';
  minPrice: string;
  maxPrice: string;
  tickSize: string;
};

export type LotSizeFilter = {
  filterType: 'LOT_SIZE';
  minQty: string;
  maxQty: string;
  stepSize: string;
};

export type MarketLotSizeFilter = {
  filterType: 'MARKET_LOT_SIZE';
  minQty: string;
  maxQty: string;
  stepSize: string;
};

export type PercentPriceFilter = {
  filterType: 'PERCENT_PRICE';
  multiplierUp: string;
  multiplierDown: string;
  avgPriceMins: number;
};

export type MinNotionalFilter = {
  filterType: 'MIN_NOTIONAL';
  notional: string;
  applyToMarket?: boolean;
  avgPriceMins?: number;
};

export type MaxNumOrdersFilter = {
  filterType: 'MAX_NUM_ORDERS' | 'MAX_NUM_ALGO_ORDERS' | 'ICEBERG_PARTS';
  limit: number;
};

// На випадок нових/рідкісних фільтрів від Binance:
export type UnknownFilter = {
  filterType: string;
  [k: string]: any;
};

export type SymbolFilter =
  | PriceFilter
  | LotSizeFilter
  | MarketLotSizeFilter
  | PercentPriceFilter
  | MinNotionalFilter
  | MaxNumOrdersFilter
  | UnknownFilter;

export function isLotFilter(
  f: SymbolFilter | undefined,
): f is LotSizeFilter | MarketLotSizeFilter {
  return (
    !!f && (f.filterType === 'LOT_SIZE' || f.filterType === 'MARKET_LOT_SIZE')
  );
}

export function isPriceFilter(f: SymbolFilter | undefined): f is PriceFilter {
  return !!f && f.filterType === 'PRICE_FILTER';
}

export type OrderSide = 'BUY' | 'SELL';

export interface FuturesOrderResponse {
  symbol: string;
  orderId: number;
  clientOrderId: string;
  price: string; // requested limit/stop price (or "0" for market)
  avgPrice: string; // average fill price (or "0" if not filled)
  origQty: string; // original order quantity
  executedQty: string; // executed quantity
  cumQuote: string; // cumulative quote asset transacted

  /** NEW | PARTIALLY_FILLED | FILLED | CANCELED | REJECTED | EXPIRED | PENDING_CANCEL? */
  status:
    | 'NEW'
    | 'PARTIALLY_FILLED'
    | 'FILLED'
    | 'CANCELED'
    | 'REJECTED'
    | 'EXPIRED'
    | 'PENDING_CANCEL'
    | 'EXPIRED_IN_MATCH';

  side: OrderSide;

  /** Placed order type */
  type:
    | 'LIMIT'
    | 'MARKET'
    | 'STOP'
    | 'STOP_MARKET'
    | 'TAKE_PROFIT'
    | 'TAKE_PROFIT_MARKET'
    | 'TRAILING_STOP_MARKET';

  /** Original type before conversions (e.g., STOP → STOP_MARKET) */
  origType:
    | 'LIMIT'
    | 'MARKET'
    | 'STOP'
    | 'STOP_MARKET'
    | 'TAKE_PROFIT'
    | 'TAKE_PROFIT_MARKET'
    | 'TRAILING_STOP_MARKET';

  /** GTC | IOC | FOK | GTX (GTX appears on some venues) */
  timeInForce?: 'GTC' | 'IOC' | 'FOK' | 'GTX';

  /** Trigger price for STOP/TP/TRAILING (as string) */
  stopPrice?: string;

  /** Trailing activation price (string) */
  activatePrice?: string;

  /** Callback rate for trailing stop (string, percent) */
  priceRate?: string;

  /** Reduce-only flag */
  reduceOnly: boolean;

  /** Close entire position on trigger (for STOP/TP market) */
  closePosition?: boolean;

  /** Working type for triggers */
  workingType?: 'MARK_PRICE' | 'CONTRACT_PRICE';

  /** Price protection flag */
  priceProtect?: boolean;

  /** BOTH | LONG | SHORT (hedge mode) */
  positionSide?: 'BOTH' | 'LONG' | 'SHORT';

  /** Last update time (ms) */
  updateTime: number;

  // Some SDKs echo these:
  /** true if order is in the order book (for REST this is often implied by status) */
  isWorking?: boolean;
}
