import { Schema } from 'mongoose';
export type IMAType = 'SMA' | 'EMA';
export type IEMASeed = 'sma' | 'first';
export type ISide = 'BUY' | 'SELL';

// Module meta interfaces
export interface ITrendMeta {
  LONG: number;
  SHORT: number;
  emaFast: number | null;
  emaSlow: number | null;
  emaGapPct: number;
  rsi: number;
  rsiRaw: number | null;
  rsiSeries: (number | null)[];
  lastRSI: number | null;
  volumes: number[];
  lastVolume: number | null;
}
export interface IVolatilityThresholds {
  deadBelow: number;
  extremeAbove: number;
}
export type IVolatilityRegime = 'DEAD' | 'NORMAL' | 'EXTREME';

export interface IVolatilityMeta {
  LONG: number;
  SHORT: number;
  regime: IVolatilityRegime;
  candlesUsed: number;
  atrAbs: number;
  atrPct: number;
  window: number;
  thresholds: IVolatilityThresholds;
}
export interface ITrendRegimeMix {
  adx: number;
  gap: number;
}
export interface ITrendRegimeMeta {
  LONG: number;
  SHORT: number;
  ADX: number;
  ADX_scaled: number;
  dirGapPct: number;
  plusDI: number;
  minusDI: number;
  period: number;
  adxSignalMin: number;
  adxMaxForScale: number;
  mix: ITrendRegimeMix;
  candlesUsed: number;
}

export interface ILiquidityMeta {
  window: number;
  avgImbalance: number;
  avgSpreadAbs: number;
  spreadPct: number | null;
  LONG: number;
  SHORT: number;
}

export interface IOpenInterestMeta {
  LONG: number;
  SHORT: number;
  candlesUsed: number;
  periodCovered: string;
  oiChangePct: number;
  oiValueChangePct: number;
  priceChangePct: number;
}

export interface ILongShortMeta {
  LONG: number;
  SHORT: number;
  pointsUsed: number;
  avgLong: number;
  avgShort: number;
  periodCovered: string;
}

export interface IHigherMAMeta {
  LONG: number;
  SHORT: number;
  timeframe: string;
  type: IMAType;
  maShort: number;
  maLong: number;
  maShortVal: number;
  maLongVal: number;
  deltaPct: number;
  priceVsLongPct: number;
  closesUsed: number;
  thresholdPct: number;
  scale: number;
  rampK: number;
  emaSeed: IEMASeed;
}

export interface IRsiVolTrendMeta {
  LONG: number;
  SHORT: number;
  candlesUsed: number;
  needBars?: number;
  reason?: 'LowVolume' | 'RSI extreme';
  progress?: string;
  rsi?: number | null;
  rsiLongScore?: number;
  rsiShortScore?: number;
  volRatio?: number;
  trendLong?: number;
  trendShort?: number;
  price?: number;
  ma7?: number;
  ma25?: number;
  maSlope?: number;
  volume?: number;
  avgVol?: number;
  rsiPeriod?: number;
  rsiWarmup?: number;
  volLookback?: number;
  maShort?: number;
  maLong?: number;
  deadZone?: number;
  candleOpen?: string;
  candleDurationMs?: number;
  rsiBoostLong?: number;
  rsiBoostShort?: number;
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
}

export interface ILiquidationsModule extends IModuleBase {
  meta: ILiquidationsMeta;
}
export interface ILiquidationsMeta {
  LONG: number;
  SHORT: number;
  candlesUsed: number;
  avgBuy: number;
  avgSell: number;
  buyPct: number;
  sellPct: number;
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

export interface IAnalysisModules {
  trend: ITrendModule | null;
  volatility: IVolatilityModule | null;
  trendRegime: ITrendRegimeModule | null;
  liquidity: ILiquidityModule | null;
  liquidations: ILiquidationsModule | null;
  openInterest: IOpenInterestModule | null;
  longShort: ILongShortModule | null;
  higherMA: IHigherMAModule | null;
  rsiVolTrend: IRsiVolTrendModule | null;
}

// Scores interface
export interface IScores {
  LONG: number;
  SHORT: number;
}

// Main Analysis interface
export interface IAnalysis {
  time: Date;
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

// Schema definitions for nested objects
const trendMetaSchema = new Schema(
  {
    LONG: { type: Number, required: true },
    SHORT: { type: Number, required: true },
    emaFast: { type: Number, required: false, default: null },
    emaSlow: { type: Number, required: false, default: null },
    emaGapPct: { type: Number, required: true },
    rsi: { type: Number, required: true },
    rsiRaw: { type: Number, required: false, default: null },
    rsiSeries: { type: [Schema.Types.Mixed], required: false, default: [] }, // allow nulls in series
    lastRSI: { type: Number, required: false, default: null },
    volumes: { type: [Number], required: false, default: [] },
    lastVolume: { type: Number, required: false, default: null },
  },
  { _id: false },
);

const volatilityThresholdsSchema = new Schema(
  {
    deadBelow: { type: Number, required: true },
    extremeAbove: { type: Number, required: true },
  },
  { _id: false },
);

const volatilityMetaSchema = new Schema(
  {
    LONG: { type: Number, required: true },
    SHORT: { type: Number, required: true },
    regime: { type: String, required: true },
    candlesUsed: { type: Number, required: true },
    atrAbs: { type: Number, required: true },
    atrPct: { type: Number, required: true },
    window: { type: Number, required: true },
    thresholds: { type: volatilityThresholdsSchema, required: true },
  },
  { _id: false },
);

const trendRegimeMixSchema = new Schema(
  {
    adx: { type: Number, required: true },
    gap: { type: Number, required: true },
  },
  { _id: false },
);

const trendRegimeMetaSchema = new Schema(
  {
    LONG: { type: Number, required: true },
    SHORT: { type: Number, required: true },
    ADX: { type: Number, required: true },
    ADX_scaled: { type: Number, required: true },
    dirGapPct: { type: Number, required: true },
    plusDI: { type: Number, required: true },
    minusDI: { type: Number, required: true },
    period: { type: Number, required: true },
    adxSignalMin: { type: Number, required: true },
    adxMaxForScale: { type: Number, required: true },
    mix: { type: trendRegimeMixSchema, required: true },
    candlesUsed: { type: Number, required: true },
  },
  { _id: false },
);

const liquidityMetaSchema = new Schema(
  {
    window: { type: Number, required: true },
    avgImbalance: { type: Number, required: true },
    avgSpreadAbs: { type: Number, required: true },
    spreadPct: { type: Number, required: true, default: null },
    LONG: { type: Number, required: true },
    SHORT: { type: Number, required: true },
  },
  { _id: false },
);
const liquidityModuleSchema = new Schema(
  {
    module: { type: String, required: true },
    symbol: { type: String, required: true },
    signal: { type: String, required: true },
    strength: { type: Number, required: true },
    meta: { type: liquidityMetaSchema, required: true },
  },
  { _id: false },
);

const openInterestMetaSchema = new Schema(
  {
    LONG: { type: Number, required: true },
    SHORT: { type: Number, required: true },
    candlesUsed: { type: Number, required: true },
    periodCovered: { type: String, required: true },
    oiChangePct: { type: Number, required: true },
    oiValueChangePct: { type: Number, required: true },
    priceChangePct: { type: Number, required: true },
  },
  { _id: false },
);

const longShortMetaSchema = new Schema(
  {
    LONG: { type: Number, required: true },
    SHORT: { type: Number, required: true },
    pointsUsed: { type: Number, required: true },
    avgLong: { type: Number, required: true },
    avgShort: { type: Number, required: true },
    periodCovered: { type: String, required: true },
  },
  { _id: false },
);

const higherMAMetaSchema = new Schema(
  {
    LONG: { type: Number, required: true },
    SHORT: { type: Number, required: true },
    timeframe: { type: String, required: true },
    type: { type: String, required: true },
    maShort: { type: Number, required: true },
    maLong: { type: Number, required: true },
    maShortVal: { type: Number, required: true },
    maLongVal: { type: Number, required: true },
    deltaPct: { type: Number, required: true },
    priceVsLongPct: { type: Number, required: true },
    closesUsed: { type: Number, required: true },
    thresholdPct: { type: Number, required: true },
    scale: { type: Number, required: true },
    rampK: { type: Number, required: true },
    emaSeed: { type: String, required: true },
  },
  { _id: false },
);

const rsiVolTrendMetaSchema = new Schema(
  {
    LONG: { type: Number, required: true },
    SHORT: { type: Number, required: true },
    candlesUsed: { type: Number, required: true },
    needBars: { type: Number, required: false },
    reason: {
      type: String,
      enum: ['LowVolume', 'RSI extreme'],
      required: false,
    },
    progress: { type: String, required: false },
    rsi: { type: Number, required: false },
    rsiLongScore: { type: Number, required: false },
    rsiShortScore: { type: Number, required: false },
    volRatio: { type: Number, required: false },
    trendLong: { type: Number, required: false },
    trendShort: { type: Number, required: false },
    price: { type: Number, required: false },
    ma7: { type: Number, required: false },
    ma25: { type: Number, required: false },
    maSlope: { type: Number, required: false },
    volume: { type: Number, required: false },
    avgVol: { type: Number, required: false },
    rsiPeriod: { type: Number, required: false },
    rsiWarmup: { type: Number, required: false },
    volLookback: { type: Number, required: false },
    maShort: { type: Number, required: false },
    maLong: { type: Number, required: false },
    deadZone: { type: Number, required: false },
    candleOpen: { type: String, required: false },
    candleDurationMs: { type: Number, required: false },
  },
  { _id: false },
);

const trendModuleSchema = new Schema(
  {
    module: { type: String, required: true },
    symbol: { type: String, required: true },
    signal: { type: String, required: true },
    strength: { type: Number, required: true },
    meta: { type: trendMetaSchema, required: true },
  },
  { _id: false },
);

const volatilityModuleSchema = new Schema(
  {
    module: { type: String, required: true },
    symbol: { type: String, required: true },
    signal: { type: String, required: true },
    strength: { type: Number, required: true },
    meta: { type: volatilityMetaSchema, required: true },
  },
  { _id: false },
);

const trendRegimeModuleSchema = new Schema(
  {
    module: { type: String, required: true },
    symbol: { type: String, required: true },
    signal: { type: String, required: true },
    strength: { type: Number, required: true },
    meta: { type: trendRegimeMetaSchema, required: true },
  },
  { _id: false },
);

const liquidationsMetaSchema = new Schema(
  {
    LONG: { type: Number, required: true },
    SHORT: { type: Number, required: true },
    candlesUsed: { type: Number, required: true },
    avgBuy: { type: Number, required: true },
    avgSell: { type: Number, required: true },
    buyPct: { type: Number, required: true },
    sellPct: { type: Number, required: true },
  },
  { _id: false },
);

const liquidationsModuleSchema = new Schema(
  {
    module: { type: String, required: true },
    symbol: { type: String, required: true },
    signal: { type: String, required: true },
    strength: { type: Number, required: true },
    meta: { type: liquidationsMetaSchema, required: true },
  },
  { _id: false },
);

const openInterestModuleSchema = new Schema(
  {
    module: { type: String, required: true },
    symbol: { type: String, required: true },
    signal: { type: String, required: true },
    strength: { type: Number, required: true },
    meta: { type: openInterestMetaSchema, required: true },
  },
  { _id: false },
);

const longShortModuleSchema = new Schema(
  {
    module: { type: String, required: true },
    symbol: { type: String, required: true },
    signal: { type: String, required: true },
    strength: { type: Number, required: true },
    meta: { type: longShortMetaSchema, required: true },
  },
  { _id: false },
);

const higherMAModuleSchema = new Schema(
  {
    module: { type: String, required: true },
    symbol: { type: String, required: true },
    signal: { type: String, required: true },
    strength: { type: Number, required: true },
    meta: { type: higherMAMetaSchema, required: true },
  },
  { _id: false },
);

const rsiVolTrendModuleSchema = new Schema(
  {
    module: { type: String, required: true },
    symbol: { type: String, required: true },
    signal: { type: String, required: true },
    strength: { type: Number, required: true },
    meta: { type: rsiVolTrendMetaSchema, required: true },
  },
  { _id: false },
);

const analysisModulesSchema = new Schema(
  {
    trend: { type: trendModuleSchema, required: false, default: null },
    volatility: {
      type: volatilityModuleSchema,
      required: false,
      default: null,
    },
    trendRegime: {
      type: trendRegimeModuleSchema,
      required: false,
      default: null,
    },
    liquidity: { type: liquidityModuleSchema, required: false, default: null },
    liquidations: {
      type: liquidationsModuleSchema,
      required: false,
      default: null,
    },
    openInterest: {
      type: openInterestModuleSchema,
      required: false,
      default: null,
    },
    longShort: { type: longShortModuleSchema, required: false, default: null },
    higherMA: { type: higherMAModuleSchema, required: false, default: null },
    rsiVolTrend: {
      type: rsiVolTrendModuleSchema,
      required: false,
      default: null,
    },
  },
  { _id: false },
);

const scoresSchema = new Schema(
  {
    LONG: { type: Number, required: true },
    SHORT: { type: Number, required: true },
  },
  { _id: false },
);

// Main Analysis schema
export const AnalysisSchema = new Schema<IAnalysis>(
  {
    time: {
      type: Date,
      required: true,
      index: true,
    },
    symbol: {
      type: String,
      required: true,
      index: true,
    },
    timeframe: {
      type: String,
      required: true,
    },
    modules: {
      type: analysisModulesSchema,
      required: true,
    },
    scores: {
      type: scoresSchema,
      required: true,
    },
    coverage: {
      type: String,
      required: true,
    },
    bias: {
      type: String,
      required: true,
    },
    decision: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
    collection: 'analysis',
  },
);

// Add compound indexes for better query performance
AnalysisSchema.index({ symbol: 1, time: 1 }, { unique: true });
AnalysisSchema.index({ time: -1 });
AnalysisSchema.index({ symbol: 1, timeframe: 1, time: -1 });
