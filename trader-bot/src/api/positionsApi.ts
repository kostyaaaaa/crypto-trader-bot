// src/api/positionsApi.ts
import type { IPosition } from 'crypto-trader-db';
import { apiClient } from '../config/api-client';
import { ApiResponse, ListResponse, UpdateResponse } from '../types';

/**
 * Create a new position
 */
export async function createPosition(position: IPosition): Promise<void> {
  try {
    await apiClient.post<ApiResponse>('/positions', position);
  } catch (error: any) {
    const message =
      error.response?.data?.message || error.message || 'Unknown error';
    throw new Error(`Failed to create position: ${message}`);
  }
}

/**
 * Get position documents
 */
export async function getPositions(
  symbol?: string,
  limit = 100,
): Promise<IPosition[]> {
  try {
    const params: Record<string, string | number> = { limit };
    if (symbol) {
      params.symbol = symbol;
    }

    const response = await apiClient.get<ListResponse<IPosition>>(
      '/positions',
      { params },
    );

    return response.data.data;
  } catch (error: any) {
    const message =
      error.response?.data?.message || error.message || 'Unknown error';
    throw new Error(`Failed to get positions: ${message}`);
  }
}

/**
 * \
 * Update a position by ID
 */
export async function updatePosition(
  positionId: string,
  updates: Partial<IPosition>,
): Promise<IPosition> {
  try {
    const response = await apiClient.patch<UpdateResponse<IPosition>>(
      `/positions/${positionId}`,
      updates,
    );

    if (!response.data.data) {
      throw new Error('No data returned from server');
    }

    return response.data.data;
  } catch (error: any) {
    const message =
      error.response?.data?.message || error.message || 'Unknown error';
    throw new Error(`Failed to update position: ${message}`);
  }
}
