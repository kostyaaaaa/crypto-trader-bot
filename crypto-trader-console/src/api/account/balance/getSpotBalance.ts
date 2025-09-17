import axiosInterceptor from '../../axiosClient';

export interface IgetSpotBalanceResponse {
  balances: {
    asset: string;
    free: string;
    locked: string;
  }[];
}
export const getSpotBalance = async (): Promise<IgetSpotBalanceResponse> => {
  const { data } = await axiosInterceptor.get(`/account/spot/balance`);

  return data;
};
