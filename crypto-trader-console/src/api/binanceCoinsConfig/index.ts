import axiosBinanceInterceptor from '../binanceClient';

export const binanceCoinsConfig =
  async (): Promise<IBinanceCoinsConfigResponse> => {
    const { data } = await axiosBinanceInterceptor.get(`/v3/exchangeInfo`);

    return data;
  };

export interface IBinanceCoinsConfigResponse {
  symbols: {
    symbol: string;
  }[];
}
