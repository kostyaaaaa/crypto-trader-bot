// Common types used across the application

export interface ApiErrorResponse {
  error: string;
  message: string;
  timestamp?: string;
}

export interface ApiSuccessResponse<T = any> {
  success: boolean;
  message?: string;
  data: T;
  timestamp?: string;
}

// Base response wrapper for all API responses
export type ApiResponse<T = any> = ApiSuccessResponse<T> | ApiErrorResponse;

// Common Binance API error structure
export interface BinanceApiError {
  code: number;
  msg: string;
}

// Generic balance interface
export interface Balance {
  asset: string;
  free: string;
  locked: string;
}

// Generic position interface
export interface Position {
  symbol: string;
  side: 'LONG' | 'SHORT' | 'BOTH';
  size: string;
  entryPrice: string;
  markPrice?: string;
  pnl?: string;
  percentage?: string;
}
