// src/api/liquidityApi.ts
import type { ILiquidity } from 'crypto-trader-db';
import { apiClient } from '../config/api-client';
import { ApiResponse, ListResponse } from '../types';

/**
 * Submit liquidity snapshot to the server
 */
export async function submitLiquiditySnapshot(
  liquidity: ILiquidity,
): Promise<void> {
  try {
    await apiClient.post<ApiResponse>('/liquidity', liquidity);
  } catch (error: any) {
    const message =
      error.response?.data?.message || error.message || 'Unknown error';
    throw new Error(`Failed to submit liquidity snapshot: ${message}`);
  }
}

/**
 * Get liquidity documents
 */
export async function getLiquidity(
  symbol?: string,
  limit = 100,
): Promise<ILiquidity[]> {
  try {
    const params: Record<string, string | number> = { limit };
    if (symbol) {
      params.symbol = symbol;
    }

    const response = await apiClient.get<ListResponse<ILiquidity>>(
      '/liquidity',
      {
        params,
      },
    );

    return response.data.data;
  } catch (error: any) {
    const message =
      error.response?.data?.message || error.message || 'Unknown error';
    throw new Error(`Failed to get liquidity: ${message}`);
  }
}
