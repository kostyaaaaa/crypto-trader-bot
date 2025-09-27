import { model, Model } from 'mongoose';
import { IPosition, PositionSchema } from '../schemas/Positions.schema.js';

// Define the model interface with static methods
export interface IPositionModel extends Model<IPosition> {
  findBySymbol(symbol: string): Promise<IPosition[]>;
  findBySymbolAndTimeRange(
    symbol: string,
    startTime: number,
    endTime: number,
  ): Promise<IPosition[]>;
  findBySymbolAndTimeGreaterThan(
    symbol: string,
    time: number,
  ): Promise<IPosition[]>;
  findOpenPositions(symbol?: string): Promise<IPosition[]>;
  findClosedPositions(symbol?: string): Promise<IPosition[]>;
  findByStatus(status: string, symbol?: string): Promise<IPosition[]>;
}

// Add static methods to the schema
PositionSchema.statics.findBySymbol = function (symbol: string) {
  return this.find({ symbol }).sort({ openedAt: -1 });
};

PositionSchema.statics.findBySymbolAndTimeRange = function (
  symbol: string,
  startTime: number,
  endTime: number,
) {
  return this.find({
    symbol,
    openedAt: { $gte: startTime, $lte: endTime },
  }).sort({ openedAt: -1 });
};

PositionSchema.statics.findBySymbolAndTimeGreaterThan = function (
  symbol: string,
  time: number,
) {
  return this.find({
    symbol,
    openedAt: { $gt: time },
  }).sort({ openedAt: 1 });
};

PositionSchema.statics.findOpenPositions = function (symbol?: string) {
  const query: any = { status: 'OPEN' };
  if (symbol) query.symbol = symbol;
  return this.find(query).sort({ openedAt: -1 });
};

PositionSchema.statics.findClosedPositions = function (symbol?: string) {
  const query: any = { status: 'CLOSED' };
  if (symbol) query.symbol = symbol;
  return this.find(query).sort({ closedAt: -1 });
};

PositionSchema.statics.findByStatus = function (
  status: string,
  symbol?: string,
) {
  const query: any = { status };
  if (symbol) query.symbol = symbol;
  return this.find(query).sort({ openedAt: -1 });
};

// Create and export the model
export const PositionModel = model<IPosition, IPositionModel>(
  'Position',
  PositionSchema,
);

// Export the interface for use in other files
export type { IPosition } from '../schemas/Positions.schema.js';
