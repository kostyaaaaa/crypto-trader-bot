import axiosInterceptor from '../axiosClient';

export const getAllCoinConfigs = async (): Promise<any> => {
  const { data } = await axiosInterceptor.get(`/coinconfig`);

  return data;
};
