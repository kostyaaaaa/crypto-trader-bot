// src/api/liquidationsApi.ts
import type { ILiquidations } from 'crypto-trader-db';
import { apiClient } from '../config/api-client';
import { ApiResponse, ListResponse } from '../types';

/**
 * Submit liquidations data to the server
 */
export async function submitLiquidations(
  liquidations: ILiquidations,
): Promise<void> {
  try {
    await apiClient.post<ApiResponse>('/liquidations', liquidations);
  } catch (error: any) {
    const message =
      error.response?.data?.message || error.message || 'Unknown error';
    throw new Error(`Failed to submit liquidations: ${message}`);
  }
}

/**
 * Get liquidations documents
 */
export async function getLiquidations(
  symbol?: string,
  limit = 100,
): Promise<ILiquidations[]> {
  try {
    const params: Record<string, string | number> = { limit };
    if (symbol) {
      params.symbol = symbol;
    }

    const response = await apiClient.get<ListResponse<ILiquidations>>(
      '/liquidations',
      { params },
    );

    return response.data.data;
  } catch (error: any) {
    const message =
      error.response?.data?.message || error.message || 'Unknown error';
    throw new Error(`Failed to get liquidations: ${message}`);
  }
}
