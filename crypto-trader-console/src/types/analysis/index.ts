export interface ITrendMeta {
  LONG: number;
  SHORT: number;
  emaFast: number;
  emaSlow: number;
  emaGapPct: number;
  rsi: number;
}

export interface IVolatilityMeta {
  LONG: number;
  SHORT: number;
  regime: string;
  candlesUsed: number;
  atrAbs: number;
  atrPct: number;
  window: number;
  thresholds: {
    deadBelow: number;
    extremeAbove: number;
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

export interface IFundingMeta {
  LONG: number;
  SHORT: number;
  candlesUsed: number;
  avgFunding: number;
}

export interface IOpenInterestMeta {
  LONG: number;
  SHORT: number;
  candlesUsed: number;
  oiChangePct: number;
  oiValueChangePct: number;
  priceChangePct: number;
}

export interface ICorrelationMeta {
  LONG: number;
  SHORT: number;
  candlesUsed: number;
  btcChangePct: number;
  group: string;
  weight: number;
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
  type: string; // 'SMA' | 'EMA'
  maShort: number;
  maLong: number;
  maShortVal: number;
  maLongVal: number;
  deltaPct: number;
  priceVsLongPct: number;
  closesUsed: number;
  thresholdPct: number;
  scale: number;
  emaSeed: string; // 'sma' | 'first'
}

// Module interfaces
export interface IModuleBase {
  module: string;
  symbol: string;
  signal: string;
  strength: number;
}

export interface ITrendModule extends IModuleBase {
  meta: ITrendMeta;
}

export interface IVolatilityModule extends IModuleBase {
  meta: IVolatilityMeta;
}

export interface ITrendRegimeModule extends IModuleBase {
  meta: ITrendRegimeMeta;
}

export interface ILiquidityModule extends IModuleBase {
  meta: ILiquidityMeta;
  spreadPct: number;
}

export interface IFundingModule extends IModuleBase {
  meta: IFundingMeta;
}

export interface ILiquidationsModule {
  symbol: string;
  time: Date;
  count: number;
  buysCount: number;
  sellsCount: number;
  buysValue: number;
  sellsValue: number;
  totalValue: number;
  minValue: number;
}

export interface IOpenInterestModule extends IModuleBase {
  meta: IOpenInterestMeta;
}

export interface ICorrelationModule extends IModuleBase {
  meta: ICorrelationMeta;
}

export interface ILongShortModule extends IModuleBase {
  meta: ILongShortMeta;
}

export interface IHigherMAModule extends IModuleBase {
  meta: IHigherMAMeta;
}

// Analysis modules container
export interface IAnalysisModules {
  trend: ITrendModule;
  volatility: IVolatilityModule;
  trendRegime: ITrendRegimeModule;
  liquidity: ILiquidityModule;
  funding: IFundingModule;
  liquidations: ILiquidationsModule;
  openInterest: IOpenInterestModule;
  correlation: ICorrelationModule;
  longShort: ILongShortModule;
  higherMA: IHigherMAModule;
}

// Scores interface
export interface IScores {
  LONG: number;
  SHORT: number;
}

// Main Analysis interface
export interface IAnalysis {
  time: Date | string;
  symbol: string;
  timeframe: string;
  modules: IAnalysisModules;
  scores: IScores;
  coverage: string;
  bias: string;
  decision: string;
  createdAt?: Date;
  updatedAt?: Date;
}
