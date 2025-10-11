// Binance exchange filters

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

// For new/rare filters from Binance:
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

export interface SymbolInfo {
  symbol: string;
  filters: SymbolFilter[];
}

// Type guards
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
