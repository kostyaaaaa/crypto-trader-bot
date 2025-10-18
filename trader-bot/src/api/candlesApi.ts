// src/api/candlesApi.ts
import type { ICandle } from 'crypto-trader-db';
import { apiClient } from '../config/api-client';
import { ApiResponse, DataResponse, ListResponse } from '../types';

/**
 * Submit candle data to the server
 */
export async function submitCandle(candle: ICandle): Promise<void> {
  try {
    await apiClient.post<ApiResponse>('/candles', candle);
  } catch (error: any) {
    const message =
      error.response?.data?.message || error.message || 'Unknown error';
    throw new Error(`Failed to submit candle: ${message}`);
  }
}

/**
 * Submit multiple candles to the server at once
 */
export async function submitCandlesBatch(candles: ICandle[]): Promise<{
  saved: number;
  updated: number;
}> {
  try {
    const response = await apiClient.post<
      DataResponse<{ saved: number; updated: number }>
    >('/candles/batch', candles);
    return response.data.data;
  } catch (error: any) {
    const message =
      error.response?.data?.message || error.message || 'Unknown error';
    throw new Error(`Failed to submit candles batch: ${message}`);
  }
}

/**
 * Get candles documents
 */
export async function getCandles(
  symbol: string,
  timeframe: string,
  limit: number = 100,
): Promise<ICandle[]> {
  try {
    const params = { symbol, timeframe, limit };

    const response = await apiClient.get<ListResponse<ICandle>>('/candles', {
      params,
    });

    return response.data.data;
  } catch (error: any) {
    const message =
      error.response?.data?.message || error.message || 'Unknown error';
    throw new Error(`Failed to get candles: ${message}`);
  }
}
