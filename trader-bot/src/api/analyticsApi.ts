// src/api/analyticsApi.ts
import type { IAnalysis } from 'crypto-trader-db';
import { apiClient } from '../config/api-client';
import { ApiResponse, ListResponse } from '../types';

/**
 * Submit analysis results to the server
 */
export async function submitAnalysis(analysis: IAnalysis): Promise<void> {
  try {
    await apiClient.post<ApiResponse>('/analytics', analysis);
  } catch (error: any) {
    const message =
      error.response?.data?.message || error.message || 'Unknown error';
    throw new Error(`Failed to submit analysis: ${message}`);
  }
}

/**
 * Get analysis documents
 */
export async function getAnalysis(
  symbol?: string,
  limit = 100,
): Promise<IAnalysis[]> {
  try {
    const params: Record<string, string | number> = { limit };
    if (symbol) {
      params.symbol = symbol;
    }

    const response = await apiClient.get<ListResponse<IAnalysis>>(
      '/analytics',
      { params },
    );

    return response.data.data;
  } catch (error: any) {
    const message =
      error.response?.data?.message || error.message || 'Unknown error';
    throw new Error(`Failed to get analysis: ${message}`);
  }
}
