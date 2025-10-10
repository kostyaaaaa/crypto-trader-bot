import { Schema } from 'mongoose';
import { AnalysisSchema, IAnalysis } from './Analysis.schema.js';

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
  ts: number;
  price?: number;
  size?: number;
  tps?: Array<{ price: number; sizePct: number }>;
  reason?: string;
}

// Position meta interface
export interface IMeta {
  leverage: number | null;
  riskPct: number | null;
  strategyName: string | null;
  openedBy: string;
}

// Main Position interface
export interface IPosition {
  symbol: string;
  side: string;
  entryPrice: number;
  size: number;
  openedAt: Date;
  status: string;
  stopPrice: number | null;
  initialStopPrice: number | null;
  realizedPnl: number;
  fees: number;
  executions: any[];
  takeProfits: ITakeProfit[];
  initialTPs: IInitialTP[];
  trailing: ITrailing | null;
  adds: any[];
  adjustments: IAdjustment[];
  analysis: IAnalysis | null;
  meta: IMeta;
  closedAt?: Date;
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
    ts: { type: Number, required: true },
    price: { type: Number, required: false },
    size: { type: Number, required: false },
    // optional array of { price, sizePct }, matches IAdjustment['tps']
    tps: { type: [initialTPSchema], required: false, default: undefined },
    reason: { type: String, required: false },
  },
  { _id: false },
);

const metaSchema = new Schema(
  {
    leverage: { type: Number, required: true, default: null },
    riskPct: { type: Number, required: true, default: null },
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
      type: Date,
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
      default: null,
    },
    initialStopPrice: {
      type: Number,
      default: null,
    },
    realizedPnl: {
      type: Number,
      default: 0,
    },
    fees: {
      type: Number,
      default: 0,
    },
    executions: {
      type: [],
      default: [],
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
      required: false,
      default: null,
    },
    adds: {
      type: [],
      default: [],
    },
    adjustments: {
      type: [adjustmentSchema],
      default: [],
    },
    analysis: {
      type: AnalysisSchema,
      required: true,
      default: null,
    },
    meta: {
      type: metaSchema,
      required: true,
    },
    closedAt: {
      type: Date,
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
