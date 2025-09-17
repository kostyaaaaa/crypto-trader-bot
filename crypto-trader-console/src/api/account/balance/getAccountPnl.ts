import axiosInterceptor from '../../axiosClient';

export const getAccountPnl = async (
  days: string = '1',
): Promise<{
  currency: string;
  data: [];
  daysBack: number;
  realizedPnL: number;
}> => {
  const { data } = await axiosInterceptor.get(`/account/pnl?days=${days}`);

  return data;
};
