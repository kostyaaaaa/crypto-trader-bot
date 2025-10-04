import { Schema } from 'mongoose';

// Module meta interfaces
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
  correlation: ICorrelationModule;
  longShort: ILongShortModule;
  higherMA: IHigherMAModule;
  rsiVolTrend: IRsiVolTrendModule;
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
    emaFast: { type: Number, required: true },
    emaSlow: { type: Number, required: true },
    emaGapPct: { type: Number, required: true },
    rsi: { type: Number, required: true },
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

const trendRegimeMetaSchema = new Schema(
  {
    LONG: { type: Number, required: true },
    SHORT: { type: Number, required: true },
    ADX: { type: Number, required: true },
    plusDI: { type: Number, required: true },
    minusDI: { type: Number, required: true },
    period: { type: Number, required: true },
    candlesUsed: { type: Number, required: true },
  },
  { _id: false },
);

const liquidityMetaSchema = new Schema(
  {
    window: { type: Number, required: true },
    avgImbalance: { type: Number, required: true },
    avgSpreadAbs: { type: Number, required: true },
    spreadPct: { type: Number, required: true },
    LONG: { type: Number, required: true },
    SHORT: { type: Number, required: true },
  },
  { _id: false },
);

const fundingMetaSchema = new Schema(
  {
    LONG: { type: Number, required: true },
    SHORT: { type: Number, required: true },
    candlesUsed: { type: Number, required: true },
    avgFunding: { type: Number, required: true },
  },
  { _id: false },
);

const openInterestMetaSchema = new Schema(
  {
    LONG: { type: Number, required: true },
    SHORT: { type: Number, required: true },
    candlesUsed: { type: Number, required: true },
    oiChangePct: { type: Number, required: true },
    oiValueChangePct: { type: Number, required: true },
    priceChangePct: { type: Number, required: true },
  },
  { _id: false },
);

const correlationMetaSchema = new Schema(
  {
    LONG: { type: Number, required: true },
    SHORT: { type: Number, required: true },
    candlesUsed: { type: Number, required: true },
    btcChangePct: { type: Number, required: true },
    group: { type: String, required: true },
    weight: { type: Number, required: true },
  },
  { _id: false },
);

const longShortMetaSchema = new Schema(
  {
    LONG: { type: Number, required: true },
    SHORT: { type: Number, required: true },
    candlesUsed: { type: Number, required: true },
    avgLong: { type: Number, required: true },
    avgShort: { type: Number, required: true },
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
    emaSeed: { type: String, required: true },
  },
  { _id: false },
);

const rsiVolTrendMetaSchema = new Schema(
  {
    LONG: { type: Number, required: true },
    SHORT: { type: Number, required: true },
    candlesUsed: { type: Number, required: true },
    rsi: { type: Number, required: true },
    price: { type: Number, required: true },
    ma7: { type: Number, required: true },
    ma25: { type: Number, required: true },
    volume: { type: Number, required: true },
    avgVol: { type: Number, required: true },
    rsiPeriod: { type: Number, required: true },
    rsiWarmup: { type: Number, required: true },
    volLookback: { type: Number, required: true },
    maShort: { type: Number, required: true },
    maLong: { type: Number, required: true },
  },
  { _id: false },
);

// Module schemas
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

const liquidityModuleSchema = new Schema(
  {
    module: { type: String, required: true },
    symbol: { type: String, required: true },
    signal: { type: String, required: true },
    strength: { type: Number, required: true },
    meta: { type: liquidityMetaSchema, required: true },
    spreadPct: { type: Number, required: true },
  },
  { _id: false },
);

const fundingModuleSchema = new Schema(
  {
    module: { type: String, required: true },
    symbol: { type: String, required: true },
    signal: { type: String, required: true },
    strength: { type: Number, required: true },
    meta: { type: fundingMetaSchema, required: true },
  },
  { _id: false },
);

const liquidationsModuleSchema = new Schema(
  {
    symbol: { type: String, required: true },
    time: { type: Date, required: true },
    count: { type: Number, required: true },
    buysCount: { type: Number, required: true },
    sellsCount: { type: Number, required: true },
    buysValue: { type: Number, required: true },
    sellsValue: { type: Number, required: true },
    totalValue: { type: Number, required: true },
    minValue: { type: Number, required: true },
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

const correlationModuleSchema = new Schema(
  {
    module: { type: String, required: true },
    symbol: { type: String, required: true },
    signal: { type: String, required: true },
    strength: { type: Number, required: true },
    meta: { type: correlationMetaSchema, required: true },
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
    trend: { type: trendModuleSchema, required: true },
    volatility: { type: volatilityModuleSchema, required: true },
    trendRegime: { type: trendRegimeModuleSchema, required: true },
    liquidity: { type: liquidityModuleSchema, required: true },
    funding: { type: fundingModuleSchema, required: true },
    liquidations: { type: liquidationsModuleSchema, required: true },
    openInterest: { type: openInterestModuleSchema, required: true },
    correlation: { type: correlationModuleSchema, required: true },
    longShort: { type: longShortModuleSchema, required: true },
    higherMA: { type: higherMAModuleSchema, required: true },
    rsiVolTrend: { type: rsiVolTrendModuleSchema, required: true },
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
