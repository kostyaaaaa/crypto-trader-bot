import { Schema } from 'mongoose';

export interface ILog {
  _id?: string;
  timestamp: Date;
  level: 'info' | 'warn' | 'error';
  message: string;
  metadata?: {
    timestamp?: string;
    metadata?: {
      data?: string;
      logType?: string;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  hostname?: string;
}

export const LogSchema = new Schema<ILog>(
  {
    timestamp: {
      type: Date,
      required: true,
      index: true,
    },
    level: {
      type: String,
      required: true,
      enum: ['info', 'warn', 'error'],
      index: true,
    },
    message: {
      type: String,
      required: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    hostname: {
      type: String,
    },
  },
  {
    timestamps: false,
    collection: 'logs',
  },
);

// Add indexes for better query performance
LogSchema.index({ timestamp: -1 });
LogSchema.index({ level: 1, timestamp: -1 });
