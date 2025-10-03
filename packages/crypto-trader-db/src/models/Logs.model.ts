import { model, Model } from 'mongoose';
import { ILog, LogSchema } from '../schemas/Logs.schema.js';

export interface ILogModel extends Model<ILog> {
  findByLevel(level: string, limit?: number): Promise<ILog[]>;
  findLatest(limit?: number): Promise<ILog[]>;
  findByDateRange(
    startDate: Date,
    endDate: Date,
    level?: string,
  ): Promise<ILog[]>;
}

// Add static methods to the schema
LogSchema.statics.findByLevel = function (level: string, limit: number = 100) {
  return this.find({ level }).sort({ timestamp: -1 }).limit(limit);
};

LogSchema.statics.findLatest = function (limit: number = 100) {
  return this.find({}).sort({ timestamp: -1 }).limit(limit);
};

LogSchema.statics.findByDateRange = function (
  startDate: Date,
  endDate: Date,
  level?: string,
) {
  const query: any = {
    timestamp: {
      $gte: startDate,
      $lte: endDate,
    },
  };

  if (level) {
    query.level = level;
  }

  return this.find(query).sort({ timestamp: -1 });
};

// Create and export the model
export const LogModel = model<ILog, ILogModel>('Log', LogSchema);

// Export the interface for use in other files
export type { ILog } from '../schemas/Logs.schema.js';
