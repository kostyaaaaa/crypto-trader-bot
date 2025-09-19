import axiosInterceptor from '../axiosClient';

export const getAllCoinConfigs = async (): Promise<{
  // edit this type
  coinconfig: string;
}> => {
  const { data } = await axiosInterceptor.get(`/coinconfig`);

  return data;
};
