import { model, Model } from 'mongoose';
import { LiquiditySchema, ILiquidity } from '../schemas/Liquidity.schema.js';

// Define the model interface with static methods
export interface ILiquidityModel extends Model<ILiquidity> {
  findBySymbol(symbol: string): Promise<ILiquidity[]>;
  findByTimeRange(
    symbol: string,
    startTime: Date,
    endTime: Date,
  ): Promise<ILiquidity[]>;
  findLatestBySymbol(symbol: string): Promise<ILiquidity | null>;
}

// Add static methods to the schema
LiquiditySchema.statics.findBySymbol = function (symbol: string) {
  return this.find({ symbol }).sort({ time: -1 });
};

LiquiditySchema.statics.findByTimeRange = function (
  symbol: string,
  startTime: Date,
  endTime: Date,
) {
  return this.find({
    symbol,
    time: { $gte: startTime, $lte: endTime },
  }).sort({ time: -1 });
};

LiquiditySchema.statics.findLatestBySymbol = function (symbol: string) {
  return this.findOne({ symbol }).sort({ time: -1 });
};

// Create and export the model
export const LiquidityModel = model<ILiquidity, ILiquidityModel>(
  'Liquidity',
  LiquiditySchema,
);

// Export the interface for use in other files
export type { ILiquidity } from '../schemas/Liquidity.schema.js';
