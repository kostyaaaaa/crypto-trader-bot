export interface Candle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}
export interface LiquidityCandle {
  symbol: string;
  time: string;
  avgImbalance: number;
  avgSpread: number;
}
