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

export interface IMarketHoursMeta {
  currentHour: number;
  timezone: string;
  tradingSession: string;
  liquidityLevel: string;
  candlesUsed: number;
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

export interface IHigherMAModule extends IModuleBase {
  meta: IHigherMAMeta;
}

export interface ILongShortModule extends IModuleBase {
  meta: ILongShortMeta;
}

export interface IRsiVolTrendModule extends IModuleBase {
  meta: IRsiVolTrendMeta;
}

// New scoring modules
export interface IVolumeModule extends IModuleBase {
  meta: IVolumeMeta;
}

export interface IMomentumModule extends IModuleBase {
  meta: IMomentumMeta;
}

// New validation modules
export interface IMarketHoursModule extends IModuleBase {
  meta: IMarketHoursMeta;
}

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
  marketHours: IMarketHoursModule;
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
