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
  lastRSI: number | null;
  lastVolume: number | null;
}
export interface IVolatilityThresholds {
  minThreshold: number;
  maxThreshold: number;
}
export type IVolatilityRegime = 'DEAD' | 'NORMAL' | 'EXTREME';

export interface IVolatilityMeta {
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

// Module type
export type ModuleType = 'validation' | 'scoring';

// Base interfaces for different module types
export interface IValidationModuleBase {
  type: 'validation';
  module: string;
  symbol: string;
  signal: 'ACTIVE' | 'NEUTRAL' | 'INACTIVE';
}

export interface IScoringModuleBase {
  type: 'scoring';
  module: string;
  symbol: string;
}

// Validation modules (volatility, liquidations)
export interface IVolatilityModule extends IValidationModuleBase {
  meta: IVolatilityMeta;
}

export interface ILiquidationsModule extends IValidationModuleBase {
  meta: ILiquidationsMeta;
}

export interface ILiquidationsMeta {
  candlesUsed: number;
  avgBuy: number;
  avgSell: number;
  buyPct: number;
  sellPct: number;
}

// Scoring modules (all others)
export interface ITrendModule extends IScoringModuleBase {
  meta: ITrendMeta;
}

export interface ITrendRegimeModule extends IScoringModuleBase {
  meta: ITrendRegimeMeta;
}

export interface ILiquidityModule extends IScoringModuleBase {
  meta: ILiquidityMeta;
}

export interface IOpenInterestModule extends IScoringModuleBase {
  meta: IOpenInterestMeta;
}

export interface IHigherMAModule extends IScoringModuleBase {
  meta: IHigherMAMeta;
}

// New scoring modules
export interface IVolumeModule extends IScoringModuleBase {
  meta: IVolumeMeta;
}

export interface IMomentumModule extends IScoringModuleBase {
  meta: IMomentumMeta;
}

export interface IAnalysisModules {
  trend: ITrendModule | null;
  volatility: IVolatilityModule | null;
  trendRegime: ITrendRegimeModule | null;
  liquidity: ILiquidityModule | null;
  liquidations: ILiquidationsModule | null;
  openInterest: IOpenInterestModule | null;
  higherMA: IHigherMAModule | null;
  // New modules (for data collection only)
  volume: IVolumeModule | null;
  momentum: IMomentumModule | null;
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
    lastRSI: { type: Number, required: false, default: null },
    lastVolume: { type: Number, required: false, default: null },
  },
  { _id: false },
);

const volatilityThresholdsSchema = new Schema(
  {
    minThreshold: { type: Number, required: true },
    maxThreshold: { type: Number, required: true },
  },
  { _id: false },
);

const volatilityMetaSchema = new Schema(
  {
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
    type: {
      type: String,
      enum: ['scoring'],
      required: true,
      default: 'scoring',
    },
    module: { type: String, required: true },
    symbol: { type: String, required: true },
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

const trendModuleSchema = new Schema(
  {
    type: {
      type: String,
      enum: ['scoring'],
      required: true,
      default: 'scoring',
    },
    module: { type: String, required: true },
    symbol: { type: String, required: true },
    meta: { type: trendMetaSchema, required: true },
  },
  { _id: false },
);

const volatilityModuleSchema = new Schema(
  {
    type: {
      type: String,
      enum: ['validation'],
      required: true,
      default: 'validation',
    },
    module: { type: String, required: true },
    symbol: { type: String, required: true },
    signal: {
      type: String,
      enum: ['ACTIVE', 'NEUTRAL', 'INACTIVE'],
      required: true,
    },
    meta: { type: volatilityMetaSchema, required: true },
  },
  { _id: false },
);

const trendRegimeModuleSchema = new Schema(
  {
    type: {
      type: String,
      enum: ['scoring'],
      required: true,
      default: 'scoring',
    },
    module: { type: String, required: true },
    symbol: { type: String, required: true },
    meta: { type: trendRegimeMetaSchema, required: true },
  },
  { _id: false },
);

const liquidationsMetaSchema = new Schema(
  {
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
    type: {
      type: String,
      enum: ['validation'],
      required: true,
      default: 'validation',
    },
    module: { type: String, required: true },
    symbol: { type: String, required: true },
    signal: {
      type: String,
      enum: ['ACTIVE', 'NEUTRAL', 'INACTIVE'],
      required: true,
    },
    meta: { type: liquidationsMetaSchema, required: true },
  },
  { _id: false },
);

const openInterestModuleSchema = new Schema(
  {
    type: {
      type: String,
      enum: ['scoring'],
      required: true,
      default: 'scoring',
    },
    module: { type: String, required: true },
    symbol: { type: String, required: true },
    meta: { type: openInterestMetaSchema, required: true },
  },
  { _id: false },
);

const higherMAModuleSchema = new Schema(
  {
    type: {
      type: String,
      enum: ['scoring'],
      required: true,
      default: 'scoring',
    },
    module: { type: String, required: true },
    symbol: { type: String, required: true },
    meta: { type: higherMAMetaSchema, required: true },
  },
  { _id: false },
);

// New module schemas
const volumeMetaSchema = new Schema(
  {
    LONG: { type: Number, required: true },
    SHORT: { type: Number, required: true },
    volumeAvg: { type: Number, required: true },
    volumeRatio: { type: Number, required: true },
    volumeTrend: { type: Number, required: true },
    volumeSpike: { type: Number, required: true },
    candlesUsed: { type: Number, required: true },
  },
  { _id: false },
);

const volumeModuleSchema = new Schema(
  {
    type: {
      type: String,
      enum: ['scoring'],
      required: true,
      default: 'scoring',
    },
    module: { type: String, required: true },
    symbol: { type: String, required: true },
    meta: { type: volumeMetaSchema, required: true },
  },
  { _id: false },
);

const momentumMetaSchema = new Schema(
  {
    LONG: { type: Number, required: true },
    SHORT: { type: Number, required: true },
    momentum: { type: Number, required: true },
    acceleration: { type: Number, required: true },
    velocity: { type: Number, required: true },
    momentumStrength: { type: Number, required: true },
    candlesUsed: { type: Number, required: true },
  },
  { _id: false },
);

const momentumModuleSchema = new Schema(
  {
    type: {
      type: String,
      enum: ['scoring'],
      required: true,
      default: 'scoring',
    },
    module: { type: String, required: true },
    symbol: { type: String, required: true },
    meta: { type: momentumMetaSchema, required: true },
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
    higherMA: { type: higherMAModuleSchema, required: false, default: null },

    // New modules (for data collection only)
    volume: { type: volumeModuleSchema, required: false, default: null },
    momentum: { type: momentumModuleSchema, required: false, default: null },
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
