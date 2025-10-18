// Shared API response types for trader-bot

/**
 * Base API response from server
 */
export interface ApiResponse {
  success: boolean;
  message: string;
  timestamp: string;
}

/**
 * Response with list of data items
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

/**
 * Response with data object
 */
export interface DataResponse<T> extends ApiResponse {
  data: T;
}
