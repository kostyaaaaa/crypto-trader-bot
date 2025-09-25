import axiosInterceptor from '../axiosClient';

export const createCoinConfig = async (): Promise<{
  count: number;
  data: [];
  message: string;
  success: boolean;
  timestamp: string;
}> => {
  const { data } = await axiosInterceptor.post(`/coinconfig`);

  return data;
};
