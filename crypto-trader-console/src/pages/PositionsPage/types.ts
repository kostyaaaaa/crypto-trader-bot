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

export interface IModuleBase {
  module: string;
  symbol: string;
  signal: string;
  strength: number;
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

// Module interfaces
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

export interface ILongShortModule extends IModuleBase {
  meta: ILongShortMeta;
}

export interface IHigherMAModule extends IModuleBase {
  meta: IHigherMAMeta;
}

export interface IRsiVolTrendModule extends IModuleBase {
  meta: IRsiVolTrendMeta;
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
  longShort: ILongShortModule;
  higherMA: IHigherMAModule;
  rsiVolTrend: IRsiVolTrendModule;
}
