import { model, Model } from 'mongoose';
import { CoinConfigSchema, ICoinConfig } from '../schemas/CoinConfig.schema.js';

// Define the model interface with static methods
export interface ICoinConfigModel extends Model<ICoinConfig> {
  findBySymbol(symbol: string): Promise<ICoinConfig | null>;
}

// Add static methods to the schema
CoinConfigSchema.statics.findBySymbol = function (symbol: string) {
  return this.findOne({ symbol });
};

// Create and export the model
export const CoinConfigModel = model<ICoinConfig, ICoinConfigModel>(
  'CoinConfig',
  CoinConfigSchema,
);

// Export the interface for use in other files
export type { ICoinConfig } from '../schemas/CoinConfig.schema.js';
