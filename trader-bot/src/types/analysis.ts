// Analysis types
import type { Side } from './common';

export interface VolatilityMeta {
  atrAbs?: number; // absolute ATR in price units
  atrPct?: number; // ATR in %
  window?: number;
  thresholds?: unknown;
  regime?: 'DEAD' | 'NORMAL' | 'EXTREME';
}

export interface AnalysisLite {
  _id?: string;
  modules?: {
    volatility?: { meta?: VolatilityMeta };
    trendRegime?: { signal?: Side | 'NEUTRAL' };
  };
}

export type VolRegime = 'DEAD' | 'EXTREME' | 'NORMAL' | string;

export interface AutoTPParams {
  entryPrice: number;
  side: Side;
  atr?: number | null;
  stopPrice?: number | null;
  regime?: VolRegime;
}

export interface TakeProfitItem {
  price: number;
  sizePct: number; // 0..100
}
