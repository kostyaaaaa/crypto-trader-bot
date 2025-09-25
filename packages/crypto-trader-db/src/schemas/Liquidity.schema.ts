import { Schema } from 'mongoose';

// Liquidity data interface
export interface ILiquidity {
  symbol: string;
  time: Date;
  avgImbalance: number;
  avgSpread: number;
  createdAt?: Date;
  updatedAt?: Date;
}

// Liquidity schema
export const LiquiditySchema = new Schema<ILiquidity>(
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
    avgImbalance: {
      type: Number,
      required: true,
    },
    avgSpread: {
      type: Number,
      required: true,
    },
  },
  {
    timestamps: true,
    collection: 'liquidity',
  },
);

// Add compound indexes for better query performance
LiquiditySchema.index({ symbol: 1, time: 1 }, { unique: true });
LiquiditySchema.index({ time: -1 });
