import axiosInterceptor from '../../axiosClient';

export interface IGetFuturesBalanceResponse {
  assets: {
    asset: string;
    availableBalance: string;
    crossUnPnl: string;
    crossWalletBalance: string;
    initialMargin: string;
    maintMargin: string;
    marginAvailable: boolean;
    marginBalance: string;
    maxWithdrawAmount: string;
    openOrderInitialMargin: string;
    positionInitialMargin: string;
    unrealizedProfit: string;
    updateTime: number;
    walletBalance: string;
  }[];
  positions: {
    askNotional: string;
    bidNotional: string;
    breakEvenPrice: string;
    entryPrice: string;
    initialMargin: string;
    isolated: boolean;
    isolatedWallet: string;
    leverage: string;
    maintMargin: string;
    maxNotional: string;
    notional: string;
    openOrderInitialMargin: string;
    positionAmt: string;
    positionInitialMargin: string;
    positionSide: string;
    symbol: string;
    unrealizedProfit: string;
    updateTime: number;
  }[];
}
export const getFuturesBalance =
  async (): Promise<IGetFuturesBalanceResponse> => {
    const { data } = await axiosInterceptor.get(`account/futures/balance`);

    return data;
  };
