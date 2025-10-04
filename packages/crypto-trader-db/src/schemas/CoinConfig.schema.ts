import { Schema } from 'mongoose';

// Analysis configuration interface
export interface IAnalysisConfig {
  candleTimeframe: string;
  oiWindow: number;
  liqWindow: number;
  liqSentWindow: number;
  fundingWindow: number;
  volWindow: number;
  corrWindow: number;
  longShortWindow: number;
  weights: {
    trend: number;
    trendRegime: number;
    liquidity: number;
    funding: number;
    liquidations: number;
    openInterest: number;
    correlation: number;
    longShort: number;
    higherMA: number;
    rsiVolTrend: number;
  };
  moduleThresholds: {
    trend: number;
    trendRegime: number;
    liquidity: number;
    funding: number;
    liquidations: number;
    openInterest: number;
    correlation: number;
    longShort: number;
    higherMA: number;
    rsiVolTrend: number;
  };
  higherMA: IHigherMAConfig;
}

export interface IHigherMAConfig {
  timeframe: string;
  maShort: number;
  maLong: number;
  type: 'SMA' | 'EMA';
  thresholdPct: number;
  scale: number;
  emaSeed: 'sma' | 'first';
}

// Strategy configuration interfaces
export interface IMinScore {
  LONG: number;
  SHORT: number;
}

export interface IAvoidWhen {
  volatility?: string;
  fundingExtreme?: {
    absOver: number;
  };
}

export interface IEntryConfig {
  minScore: IMinScore;
  minModules: number;
  requiredModules: string[];
  maxSpreadPct: number;
  cooldownMin: number;
  avoidWhen: IAvoidWhen;
  sideBiasTolerance: number;
}

export interface ICapitalConfig {
  account: number;
  riskPerTradePct: number;
  leverage: number;
  maxConcurrentPositions: number;
}

export interface ISizingConfig {
  maxAdds: number;
  addOnAdverseMovePct: number;
  addMultiplier: number;
}

export interface ITpConfig {
  use: boolean;
  tpGridPct: number[];
  tpGridSizePct: number[];
}

export interface ISignalRules {
  flipIf: {
    scoreGap: number;
    minOppScore: number;
  };
  moduleFail: {
    required: string[];
  };
}

export interface ISlConfig {
  type: 'hard' | 'atr';
  hardPct?: number;
  atrMult?: number;
  signalRules?: ISignalRules;
}

export interface ITimeConfig {
  maxHoldMin: number;
  noPnLFallback: 'none' | 'breakeven' | 'closeSmallLoss';
}

export interface ITrailingConfig {
  use: boolean;
  startAfterPct: number;
  trailStepPct: number;
}
export interface IVolatilityFilterConfig {
  deadBelow: number;
  extremeAbove: number;
}

export interface IExitsConfig {
  tp: ITpConfig;
  sl: ISlConfig;
  time: ITimeConfig;
  trailing: ITrailingConfig;
  oppositeCountExit: number;
}

export interface IStrategyConfig {
  entry: IEntryConfig;
  capital: ICapitalConfig;
  sizing: ISizingConfig;
  exits: IExitsConfig;
  volatilityFilter: IVolatilityFilterConfig;
}

// Main coin configuration interface
export interface ICoinConfig {
  symbol: string;
  isActive: boolean;
  analysisConfig: IAnalysisConfig;
  strategy: IStrategyConfig;
  createdAt?: Date;
  updatedAt?: Date;
}

// Mongoose schema definitions
const weightsSchema = new Schema(
  {
    trend: { type: Number, required: true },
    trendRegime: { type: Number, required: true },
    liquidity: { type: Number, required: true },
    funding: { type: Number, required: true },
    liquidations: { type: Number, required: true },
    openInterest: { type: Number, required: true },
    correlation: { type: Number, required: true },
    longShort: { type: Number, required: true },
    higherMA: { type: Number, required: true },
    rsiVolTrend: { type: Number, required: true },
  },
  { _id: false },
);

const moduleThresholdsSchema = new Schema(
  {
    trend: { type: Number, required: true },
    trendRegime: { type: Number, required: true },
    liquidity: { type: Number, required: true },
    funding: { type: Number, required: true },
    liquidations: { type: Number, required: true },
    openInterest: { type: Number, required: true },
    correlation: { type: Number, required: true },
    longShort: { type: Number, required: true },
    higherMA: { type: Number, required: true },
    rsiVolTrend: { type: Number, required: true },
  },
  { _id: false },
);

const higherMASchema = new Schema(
  {
    timeframe: { type: String, required: true },
    maShort: { type: Number, required: true },
    maLong: { type: Number, required: true },
    type: { type: String, enum: ['SMA', 'EMA'], required: true },
    thresholdPct: { type: Number, required: true },
    scale: { type: Number, required: true },
    emaSeed: { type: String, enum: ['sma', 'first'], required: true },
  },
  { _id: false },
);

const analysisConfigSchema = new Schema(
  {
    candleTimeframe: { type: String, required: true },
    oiWindow: { type: Number, required: true },
    liqWindow: { type: Number, required: true },
    liqSentWindow: { type: Number, required: true },
    fundingWindow: { type: Number, required: true },
    volWindow: { type: Number, required: true },
    corrWindow: { type: Number, required: true },
    longShortWindow: { type: Number, required: true },
    weights: { type: weightsSchema, required: true },
    moduleThresholds: { type: moduleThresholdsSchema, required: true },
    higherMA: { type: higherMASchema, required: true },
  },
  { _id: false },
);

const minScoreSchema = new Schema(
  {
    LONG: { type: Number, required: true },
    SHORT: { type: Number, required: true },
  },
  { _id: false },
);

const fundingExtremeSchema = new Schema(
  {
    absOver: { type: Number, required: true },
  },
  { _id: false },
);

const avoidWhenSchema = new Schema(
  {
    volatility: { type: String },
    fundingExtreme: { type: fundingExtremeSchema },
  },
  { _id: false },
);

const entryConfigSchema = new Schema(
  {
    minScore: { type: minScoreSchema, required: true },
    minModules: { type: Number, required: true },
    requiredModules: { type: [String], required: true },
    maxSpreadPct: { type: Number, required: true },
    cooldownMin: { type: Number, required: true },
    avoidWhen: { type: avoidWhenSchema, required: true },
    sideBiasTolerance: { type: Number, required: true },
  },
  { _id: false },
);

const capitalConfigSchema = new Schema(
  {
    account: { type: Number, required: true },
    riskPerTradePct: { type: Number, required: true },
    leverage: { type: Number, required: true },
    maxConcurrentPositions: { type: Number, required: true },
  },
  { _id: false },
);

const sizingConfigSchema = new Schema(
  {
    maxAdds: { type: Number, required: true },
    addOnAdverseMovePct: { type: Number, required: true },
    addMultiplier: { type: Number, required: true },
  },
  { _id: false },
);

const tpConfigSchema = new Schema(
  {
    use: { type: Boolean, required: true },
    tpGridPct: { type: [Number], required: true },
    tpGridSizePct: { type: [Number], required: true },
  },
  { _id: false },
);

const flipIfSchema = new Schema(
  {
    scoreGap: { type: Number, required: true },
    minOppScore: { type: Number, required: true },
  },
  { _id: false },
);

const moduleFailSchema = new Schema(
  {
    required: { type: [String], required: true },
  },
  { _id: false },
);

const signalRulesSchema = new Schema(
  {
    flipIf: { type: flipIfSchema, required: true },
    moduleFail: { type: moduleFailSchema, required: true },
  },
  { _id: false },
);

const slConfigSchema = new Schema(
  {
    type: { type: String, enum: ['atr', 'hard'], required: true },
    hardPct: { type: Number },
    atrMult: { type: Number },
    signalRules: { type: signalRulesSchema },
  },
  { _id: false },
);

const timeConfigSchema = new Schema(
  {
    maxHoldMin: { type: Number, required: true },
    noPnLFallback: {
      type: String,
      enum: ['none', 'breakeven', 'closeSmallLoss'],
      required: true,
    },
  },
  { _id: false },
);

const trailingConfigSchema = new Schema(
  {
    use: { type: Boolean, required: true },
    startAfterPct: { type: Number, required: true },
    trailStepPct: { type: Number, required: true },
  },
  { _id: false },
);

const exitsConfigSchema = new Schema(
  {
    tp: { type: tpConfigSchema, required: true },
    sl: { type: slConfigSchema, required: true },
    time: { type: timeConfigSchema, required: true },
    trailing: { type: trailingConfigSchema, required: true },
    oppositeCountExit: { type: Number, required: true },
  },
  { _id: false },
);
const volatilityFilterSchema = new Schema(
  {
    deadBelow: { type: Number, required: true },
    extremeAbove: { type: Number, required: true },
  },
  { _id: false },
);
const strategyConfigSchema = new Schema(
  {
    entry: { type: entryConfigSchema, required: true },
    volatilityFilter: { type: volatilityFilterSchema, required: true },
    capital: { type: capitalConfigSchema, required: true },
    sizing: { type: sizingConfigSchema, required: true },
    exits: { type: exitsConfigSchema, required: true },
  },
  { _id: false },
);

// Main CoinConfig schema
export const CoinConfigSchema = new Schema<ICoinConfig>(
  {
    symbol: {
      type: String,
      required: true,
    },
    isActive: { type: Boolean, required: true },
    analysisConfig: { type: analysisConfigSchema, required: true },
    strategy: { type: strategyConfigSchema, required: true },
  },
  {
    timestamps: true,
    collection: 'coinconfig',
  },
);

// Add indexes for better query performance
CoinConfigSchema.index({ symbol: 1 }, { unique: true });
CoinConfigSchema.index({ createdAt: -1 });
CoinConfigSchema.index({ updatedAt: -1 });
