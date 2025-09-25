import { model, Model } from 'mongoose';
import {
  LiquidationsSchema,
  ILiquidations,
} from '../schemas/Liquidations.schema.js';

// Define the model interface with static methods
export interface ILiquidationsModel extends Model<ILiquidations> {
  findBySymbol(symbol: string): Promise<ILiquidations[]>;
  findByTimeRange(
    symbol: string,
    startTime: Date,
    endTime: Date,
  ): Promise<ILiquidations[]>;
  findLatestBySymbol(symbol: string): Promise<ILiquidations | null>;
  findByMinValue(symbol: string, minValue: number): Promise<ILiquidations[]>;
}

// Add static methods to the schema
LiquidationsSchema.statics.findBySymbol = function (symbol: string) {
  return this.find({ symbol }).sort({ time: -1 });
};

LiquidationsSchema.statics.findByTimeRange = function (
  symbol: string,
  startTime: Date,
  endTime: Date,
) {
  return this.find({
    symbol,
    time: { $gte: startTime, $lte: endTime },
  }).sort({ time: -1 });
};

LiquidationsSchema.statics.findLatestBySymbol = function (symbol: string) {
  return this.findOne({ symbol }).sort({ time: -1 });
};

LiquidationsSchema.statics.findByMinValue = function (
  symbol: string,
  minValue: number,
) {
  return this.find({ symbol, totalValue: { $gte: minValue } }).sort({
    time: -1,
  });
};

// Create and export the model
export const LiquidationsModel = model<ILiquidations, ILiquidationsModel>(
  'Liquidations',
  LiquidationsSchema,
);

// Export the interface for use in other files
export type { ILiquidations } from '../schemas/Liquidations.schema.js';
