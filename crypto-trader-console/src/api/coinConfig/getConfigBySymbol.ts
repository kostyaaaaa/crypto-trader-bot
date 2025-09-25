import type { TCoinConfigResponse } from '../../types';
import axiosInterceptor from '../axiosClient';

export const getConfigBySymbol = async (
  symbol: string,
): Promise<{
  count: number;
  data: TCoinConfigResponse;
  message: string;
  success: boolean;
  timestamp: string;
}> => {
  const { data } = await axiosInterceptor.get(`/coinconfig/${symbol}`);

  return data;
};
