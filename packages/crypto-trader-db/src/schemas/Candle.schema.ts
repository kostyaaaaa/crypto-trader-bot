import { Schema } from 'mongoose';

// ========== CANDLES SCHEMA ==========

export interface ICandle {
  symbol: string;
  timeframe: string;
  time: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export const CandleSchema = new Schema<ICandle>(
  {
    symbol: {
      type: String,
      required: true,
      index: true,
    },
    timeframe: {
      type: String,
      required: true,
      enum: ['1m', '5m', '15m', '1h', '4h', '1d'],
      index: true,
    },
    time: {
      type: Date,
      required: true,
      index: true,
    },
    open: {
      type: Number,
      required: true,
    },
    high: {
      type: Number,
      required: true,
    },
    low: {
      type: Number,
      required: true,
    },
    close: {
      type: Number,
      required: true,
    },
    volume: {
      type: Number,
      required: true,
    },
  },
  {
    timestamps: true,
    collection: 'candles',
  },
);

// Add compound indexes for better query performance
CandleSchema.index({ symbol: 1, timeframe: 1, time: 1 }, { unique: true });
CandleSchema.index({ symbol: 1, time: -1 });
CandleSchema.index({ timeframe: 1, time: -1 });
