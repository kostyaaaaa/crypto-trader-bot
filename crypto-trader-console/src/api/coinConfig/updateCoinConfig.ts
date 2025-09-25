import type { TCoinConfig, TCoinConfigResponse } from '../../types';
import axiosInterceptor from '../axiosClient';

export const updateCoinConfig = async (
  body: TCoinConfig,
): Promise<{
  data: TCoinConfigResponse;
  message: string;
  success: boolean;
  timestamp: string;
}> => {
  const { data } = await axiosInterceptor.put(
    `/coinconfig/${body.symbol}`,
    body,
  );

  return data;
};
