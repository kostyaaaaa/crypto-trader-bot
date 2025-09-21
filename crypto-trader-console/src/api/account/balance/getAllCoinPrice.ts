import axiosBinanceInterceptor from '../../binanceClient';

export const getAllCoinPrice = async (): Promise<
  {
    price: string;
    symbol: string;
  }[]
> => {
  const { data } = await axiosBinanceInterceptor.get(`/v3/ticker/price`);

  return data;
};
