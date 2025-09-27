import { Schema } from 'mongoose';

// Take profit interface
export interface ITakeProfit {
  price: number;
  sizePct: number;
  filled?: boolean;
}

// Initial take profit interface
export interface IInitialTP {
  price: number;
  sizePct: number;
}

// Trailing configuration interface
export interface ITrailing {
  active: boolean;
  startAfterPct: number;
  trailStepPct: number;
  anchor: number | null;
}

// Position adjustment interface
export interface IAdjustment {
  type: string;
  price: number;
  reason: string;
  ts: number;
}

// Analysis reference interface
export interface IAnalysisRef {
  analysisId: Schema.Types.ObjectId;
  bias: string;
  scores: {
    LONG: number;
    SHORT: number;
  };
}

// Position meta interface
export interface IMeta {
  leverage: number;
  riskPct: number;
  strategyName: string | null;
  openedBy: string;
}

// Main Position interface
export interface IPosition {
  symbol: string;
  side: string;
  entryPrice: number;
  size: number;
  openedAt: number;
  status: string;
  stopPrice: number;
  initialStopPrice: number | null;
  takeProfits: ITakeProfit[];
  initialTPs: IInitialTP[];
  trailing: ITrailing;
  adds: any[];
  adjustments: IAdjustment[];
  analysisRef: IAnalysisRef;
  meta: IMeta;
  closedAt?: number;
  closedBy?: string;
  finalPnl?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

// Schema definitions for nested objects
const takeProfitSchema = new Schema(
  {
    price: { type: Number, required: true },
    sizePct: { type: Number, required: true },
    filled: { type: Boolean, default: false },
  },
  { _id: false },
);

const initialTPSchema = new Schema(
  {
    price: { type: Number, required: true },
    sizePct: { type: Number, required: true },
  },
  { _id: false },
);

const trailingSchema = new Schema(
  {
    active: { type: Boolean, required: true },
    startAfterPct: { type: Number, required: true },
    trailStepPct: { type: Number, required: true },
    anchor: { type: Number, default: null },
  },
  { _id: false },
);

const adjustmentSchema = new Schema(
  {
    type: { type: String, required: true },
    price: { type: Number, required: true },
    reason: { type: String, required: true },
    ts: { type: Number, required: true },
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

const analysisRefSchema = new Schema(
  {
    analysisId: { type: Schema.Types.ObjectId, required: true },
    bias: { type: String, required: true },
    scores: { type: scoresSchema, required: true },
  },
  { _id: false },
);

const metaSchema = new Schema(
  {
    leverage: { type: Number, required: true },
    riskPct: { type: Number, required: true },
    strategyName: { type: String, default: null },
    openedBy: { type: String, required: true },
  },
  { _id: false },
);

// Main Position schema
export const PositionSchema = new Schema<IPosition>(
  {
    symbol: {
      type: String,
      required: true,
      index: true,
    },
    side: {
      type: String,
      required: true,
      enum: ['LONG', 'SHORT'],
    },
    entryPrice: {
      type: Number,
      required: true,
    },
    size: {
      type: Number,
      required: true,
    },
    openedAt: {
      type: Number,
      required: true,
      index: true,
    },
    status: {
      type: String,
      required: true,
      enum: ['OPEN', 'CLOSED', 'CANCELLED'],
    },
    stopPrice: {
      type: Number,
      required: true,
    },
    initialStopPrice: {
      type: Number,
      default: null,
    },
    takeProfits: {
      type: [takeProfitSchema],
      required: true,
    },
    initialTPs: {
      type: [initialTPSchema],
      required: true,
    },
    trailing: {
      type: trailingSchema,
      required: true,
    },
    adds: {
      type: [],
      default: [],
    },
    adjustments: {
      type: [adjustmentSchema],
      default: [],
    },
    analysisRef: {
      type: analysisRefSchema,
      required: true,
    },
    meta: {
      type: metaSchema,
      required: true,
    },
    closedAt: {
      type: Number,
      index: true,
    },
    closedBy: {
      type: String,
    },
    finalPnl: {
      type: Number,
    },
  },
  {
    timestamps: true,
    collection: 'positions',
  },
);

// Add compound indexes for better query performance
PositionSchema.index({ symbol: 1, openedAt: 1 });
PositionSchema.index({ symbol: 1, closedAt: 1 });
PositionSchema.index({ openedAt: -1 });
PositionSchema.index({ closedAt: -1 });
PositionSchema.index({ status: 1 });
