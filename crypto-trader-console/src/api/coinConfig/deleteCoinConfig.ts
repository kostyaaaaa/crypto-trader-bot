import axiosInterceptor from '../axiosClient';

export const deleteCoinConfig = async (symbol: string) => {
  const { data } = await axiosInterceptor.delete(`/coinconfig/${symbol}`);

  return data;
};
