// Analysis Types for PositionsPage
export interface IAnalysis {
  _id?: string;
  time: Date | string;
  symbol: string;
  timeframe: string;
  modules: IAnalysisModules;
  scores: {
    LONG: number;
    SHORT: number;
  };
  coverage?: string;
  bias: string;
  decision?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// Base for validation modules
export interface IValidationModuleBase {
  type: 'validation';
  module: string;
  symbol: string;
  signal: 'ACTIVE' | 'NEUTRAL' | 'INACTIVE';
}

// Base for scoring modules
export interface IScoringModuleBase {
  type: 'scoring';
  module: string;
  symbol: string;
}

// Legacy base (for backward compatibility)
export interface IModuleBase {
  type?: 'validation' | 'scoring';
  module: string;
  symbol: string;
  signal?: string;
  strength?: number;
}

// Meta interfaces with LONG/SHORT scores
export interface ITrendMeta {
  LONG: number;
  SHORT: number;
  emaFast: number;
  emaSlow: number;
  emaGapPct: number;
  rsi: number;
}

export interface IVolatilityMeta {
  regime: string;
  candlesUsed: number;
  atrAbs: number;
  atrPct: number;
  window: number;
  thresholds: {
    minThreshold: number;
    maxThreshold: number;
  };
}

export interface ITrendRegimeMeta {
  LONG: number;
  SHORT: number;
  ADX: number;
  plusDI: number;
  minusDI: number;
  period: number;
  candlesUsed: number;
}

export interface ILiquidityMeta {
  window: number;
  avgImbalance: number;
  avgSpreadAbs: number;
  spreadPct: number;
  LONG: number;
  SHORT: number;
}

export interface IOpenInterestMeta {
  LONG: number;
  SHORT: number;
  candlesUsed: number;
  oiChangePct: number;
  oiValueChangePct: number;
  priceChangePct: number;
}

export interface ILongShortMeta {
  LONG: number;
  SHORT: number;
  candlesUsed: number;
  avgLong: number;
  avgShort: number;
}

export interface IHigherMAMeta {
  LONG: number;
  SHORT: number;
  timeframe: string;
  type: string;
  maShort: number;
  maLong: number;
  maShortVal: number;
  maLongVal: number;
  deltaPct: number;
  priceVsLongPct: number;
  closesUsed: number;
  thresholdPct: number;
  scale: number;
  emaSeed: string;
}

export interface IRsiVolTrendMeta {
  LONG: number;
  SHORT: number;
  candlesUsed: number;
  rsi: number;
  price: number;
  ma7: number;
  ma25: number;
  volume: number;
  avgVol: number;
  rsiPeriod: number;
  rsiWarmup: number;
  volLookback: number;
  maShort: number;
  maLong: number;
}

// New meta interfaces
export interface IVolumeMeta {
  LONG: number;
  SHORT: number;
  volumeAvg: number;
  volumeRatio: number;
  volumeTrend: number;
  volumeSpike: number;
  candlesUsed: number;
}

export interface IMomentumMeta {
  LONG: number;
  SHORT: number;
  momentum: number;
  acceleration: number;
  velocity: number;
  momentumStrength: number;
  candlesUsed: number;
}

// Module interfaces - Scoring modules
export interface ITrendModule extends IScoringModuleBase {
  meta: ITrendMeta;
}

// Module interfaces - Validation modules
export interface IVolatilityModule extends IValidationModuleBase {
  meta: IVolatilityMeta;
}

export interface ITrendRegimeModule extends IScoringModuleBase {
  meta: ITrendRegimeMeta;
}

export interface ILiquidityModule extends IScoringModuleBase {
  meta: ILiquidityMeta;
  spreadPct: number;
}

export interface ILiquidationsMeta {
  candlesUsed: number;
  avgBuy: number;
  avgSell: number;
  buyPct: number;
  sellPct: number;
}

export interface ILiquidationsModule extends IValidationModuleBase {
  meta: ILiquidationsMeta;
}

export interface IOpenInterestModule extends IScoringModuleBase {
  meta: IOpenInterestMeta;
}

export interface ILongShortModule extends IScoringModuleBase {
  meta: ILongShortMeta;
}

export interface IHigherMAModule extends IScoringModuleBase {
  meta: IHigherMAMeta;
}

export interface IRsiVolTrendModule extends IScoringModuleBase {
  meta: IRsiVolTrendMeta;
}

// New scoring modules
export interface IVolumeModule extends IScoringModuleBase {
  meta: IVolumeMeta;
}

export interface IMomentumModule extends IScoringModuleBase {
  meta: IMomentumMeta;
}

// New validation modules

// Analysis modules container
export interface IAnalysisModules {
  trend: ITrendModule;
  volatility: IVolatilityModule;
  trendRegime: ITrendRegimeModule;
  liquidity: ILiquidityModule;
  liquidations: ILiquidationsModule;
  openInterest: IOpenInterestModule;
  longShort: ILongShortModule;
  higherMA: IHigherMAModule;
  rsiVolTrend: IRsiVolTrendModule;
  // New modules (for data collection only)
  volume: IVolumeModule;
  momentum: IMomentumModule;
}
