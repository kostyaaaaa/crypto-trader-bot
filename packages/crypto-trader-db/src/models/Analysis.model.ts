import { model, Model } from 'mongoose';
import { AnalysisSchema, IAnalysis } from '../schemas/Analysis.schema.js';

// Define the model interface with static methods
export interface IAnalysisModel extends Model<IAnalysis> {
  findBySymbol(symbol: string): Promise<IAnalysis[]>;
  findByTimeRange(
    symbol: string,
    startTime: Date,
    endTime: Date,
  ): Promise<IAnalysis[]>;
  findLatestBySymbol(symbol: string): Promise<IAnalysis | null>;
  findByTimeframe(symbol: string, timeframe: string): Promise<IAnalysis[]>;
  findByBias(symbol: string, bias: string): Promise<IAnalysis[]>;
  findByDecision(symbol: string, decision: string): Promise<IAnalysis[]>;
}

// Add static methods to the schema
AnalysisSchema.statics.findBySymbol = function (symbol: string) {
  return this.find({ symbol }).sort({ time: -1 });
};

AnalysisSchema.statics.findByTimeRange = function (
  symbol: string,
  startTime: Date,
  endTime: Date,
) {
  return this.find({
    symbol,
    time: { $gte: startTime, $lte: endTime },
  }).sort({ time: -1 });
};

AnalysisSchema.statics.findLatestBySymbol = function (symbol: string) {
  return this.findOne({ symbol }).sort({ time: -1 });
};

AnalysisSchema.statics.findByTimeframe = function (
  symbol: string,
  timeframe: string,
) {
  return this.find({ symbol, timeframe }).sort({ time: -1 });
};

AnalysisSchema.statics.findByBias = function (symbol: string, bias: string) {
  return this.find({ symbol, bias }).sort({ time: -1 });
};

AnalysisSchema.statics.findByDecision = function (
  symbol: string,
  decision: string,
) {
  return this.find({ symbol, decision }).sort({ time: -1 });
};

// Create and export the model
export const AnalysisModel = model<IAnalysis, IAnalysisModel>(
  'Analysis',
  AnalysisSchema,
);

// Export the interface for use in other files
export type { IAnalysis } from '../schemas/Analysis.schema.js';
