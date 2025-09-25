import { Schema } from 'mongoose';

// Liquidations data interface
export interface ILiquidations {
  symbol: string;
  time: Date;
  count: number;
  buysCount: number;
  sellsCount: number;
  buysValue: number;
  sellsValue: number;
  totalValue: number;
  minValue: number;
  createdAt?: Date;
  updatedAt?: Date;
}

// Liquidations schema
export const LiquidationsSchema = new Schema<ILiquidations>(
  {
    symbol: {
      type: String,
      required: true,
      index: true,
    },
    time: {
      type: Date,
      required: true,
      index: true,
    },
    count: {
      type: Number,
      required: true,
    },
    buysCount: {
      type: Number,
      required: true,
    },
    sellsCount: {
      type: Number,
      required: true,
    },
    buysValue: {
      type: Number,
      required: true,
    },
    sellsValue: {
      type: Number,
      required: true,
    },
    totalValue: {
      type: Number,
      required: true,
    },
    minValue: {
      type: Number,
      required: true,
    },
  },
  {
    timestamps: true,
    collection: 'liquidations',
  },
);

// Add compound indexes for better query performance
LiquidationsSchema.index({ symbol: 1, time: 1 }, { unique: true });
LiquidationsSchema.index({ time: -1 });
