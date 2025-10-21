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

export interface IZonesMeta {
  LONG: number;
  SHORT: number;
  support1: number | null;
  support2: number | null;
  resistance1: number | null;
  resistance2: number | null;
  referencePrice: number;
  currentPrice: number;
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

// New scoring modules
export interface IVolumeModule extends IModuleBase {
  meta: IVolumeMeta;
}

export interface IMomentumModule extends IModuleBase {
  meta: IMomentumMeta;
}

export interface IZonesModule extends IModuleBase {
  meta: IZonesMeta;
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
  higherMA: IHigherMAModule;
  // New modules (for data collection only)
  volume: IVolumeModule;
  momentum: IMomentumModule;
  zones: IZonesModule;
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
