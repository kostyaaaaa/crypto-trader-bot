import axiosInterceptor from '../../axiosClient';

export interface IGetSpotBalanceResponse {
  balances: {
    asset: string;
    free: string;
    locked: string;
  }[];
}
export const getSpotBalance = async (): Promise<IGetSpotBalanceResponse> => {
  const { data } = await axiosInterceptor.get(`/account/spot/balance`);

  return data;
};
