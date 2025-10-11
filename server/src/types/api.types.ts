// Generic API response types

/**
 * Base API response
 */
export interface ApiResponse {
  success: boolean;
  message: string;
  timestamp: string;
}

/**
 * API error response
 */
export interface ApiErrorResponse {
  error: string;
  message: string;
}

/**
 * Generic response with single data item
 */
export interface DataResponse<T> extends ApiResponse {
  data: T;
}

/**
 * Generic response with list of data items
 */
export interface ListResponse<T> extends ApiResponse {
  data: T[];
  count: number;
}

/**
 * Response with optional data (for updates that might return null)
 */
export interface UpdateResponse<T> extends ApiResponse {
  data: T | null;
}
