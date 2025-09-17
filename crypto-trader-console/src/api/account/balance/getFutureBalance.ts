import axiosInterceptor from '../../axiosClient';

export interface IgetFuturesBalanceResponse {
  positions: {
    positionAmt: string;
    symbol: string;
    positionSide: string;
  }[];
}
export const getFuturesBalance =
  async (): Promise<IgetFuturesBalanceResponse> => {
    const { data } = await axiosInterceptor.get(`account/futures/balance`);

    return data;
  };
