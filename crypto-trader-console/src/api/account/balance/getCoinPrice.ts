import axiosBinanceInterceptor from '../../binanceClient';

export const getCoinPrice = async (
  symbol: string,
): Promise<{
  price: string;
  symbol: string;
}> => {
  const { data } = await axiosBinanceInterceptor.get(
    `/v3/ticker/price?symbol=${symbol}USDT`,
  );

  return data;
};
