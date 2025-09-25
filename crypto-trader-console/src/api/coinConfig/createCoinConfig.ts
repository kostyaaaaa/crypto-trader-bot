import type { TCoinConfig, TCoinConfigResponse } from '../../types';
import axiosInterceptor from '../axiosClient';

export const createCoinConfig = async (
  body: TCoinConfig,
): Promise<{
  data: TCoinConfigResponse;
  message: string;
  success: boolean;
  timestamp: string;
}> => {
  const { data } = await axiosInterceptor.post(`/coinconfig`, body);

  return data;
};
