// Binance market data types

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
