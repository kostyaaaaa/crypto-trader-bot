import type { ILog } from 'crypto-trader-db';

// Re-export the database log interface for convenience
export type { ILog } from 'crypto-trader-db';

// Log-related handler types
export type LogUpdateHandler = (log: ILog) => void;
export type LogBatchHandler = (logs: ILog[]) => void;
