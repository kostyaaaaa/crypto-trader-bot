// Type definitions for crypto trading data structures
// These will be used when implementing MongoDB functionality

export interface DatabaseConfig {
  connectionString: string;
  databaseName: string;
  options?: {
    maxPoolSize?: number;
    minPoolSize?: number;
    maxIdleTimeMS?: number;
    serverSelectionTimeoutMS?: number;
  };
}

// Base document interface for MongoDB documents
export interface BaseDocument {
  _id?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// Placeholder type - will be expanded based on your requirements
export interface TradingData extends BaseDocument {
  symbol: string;
  timestamp: Date;
  // More fields will be added based on your specific needs
}
