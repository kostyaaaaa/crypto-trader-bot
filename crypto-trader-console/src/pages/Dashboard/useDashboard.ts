import { useQuery } from '@tanstack/react-query';
import {
  QueryKeys,
  getAccountPnl,
  getAllCoinPrice,
  getFuturesBalance,
  getSpotBalance,
  type IGetFuturesBalanceResponse,
  type IGetSpotBalanceResponse,
} from '../../api';
import { useMemo, useState } from 'react';

const useDashboard = () => {
  const [spotBalance, setSpotBalance] = useState<
    IGetSpotBalanceResponse['balances'] | null
  >(null);

  const [futuresAssets, setFuturesAssets] =
    useState<IGetFuturesBalanceResponse['assets']>();

  const [futuresPositions, setFuturesPositions] =
    useState<IGetFuturesBalanceResponse['positions']>();

  const { data: accountPnlData } = useQuery({
    queryKey: [QueryKeys.AccountPnl],
    queryFn: () => getAccountPnl(),
    refetchOnWindowFocus: false,
  });

  useQuery<IGetSpotBalanceResponse, Error>({
    queryKey: [QueryKeys.SpotBalance],
    queryFn: async () => {
      const data = await getSpotBalance();
      setSpotBalance(
        data.balances.filter(
          (b: { free: string; locked: string }) =>
            parseFloat(b.free) > 0 || parseFloat(b.locked) > 0,
        ),
      );

      return data;
    },
    refetchOnWindowFocus: false,
  });

  const {
    refetch: refetchFuturesPositions,
    isLoading: isLoadingFuturesPositions,
  } = useQuery<IGetFuturesBalanceResponse, Error>({
    queryKey: [QueryKeys.FuturesBalance],
    queryFn: async () => {
      const data = await getFuturesBalance();
      setFuturesAssets(
        data.assets.filter(
          (a) =>
            parseFloat(a.walletBalance) > 0 ||
            parseFloat(a.unrealizedProfit) !== 0,
        ),
      );

      setFuturesPositions(
        data.positions.filter((p) => parseFloat(p.positionAmt) !== 0),
      );

      return data;
    },
    refetchOnWindowFocus: false,
  });

  const { data: allSpotPrices } = useQuery({
    queryKey: [QueryKeys.AllSpotPrices],
    queryFn: getAllCoinPrice,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });

  const spotUSDBalance = useMemo(() => {
    if (!spotBalance || !allSpotPrices) return 0;

    const priceMap = new Map(
      allSpotPrices.map((p) => [p.symbol, parseFloat(p.price)]),
    );

    return spotBalance.reduce((sum, b) => {
      const amount = parseFloat(b.free) + parseFloat(b.locked);

      if (['USDT', 'BUSD', 'USDC'].includes(b.asset)) {
        return sum + amount;
      }

      const symbol = `${b.asset}USDT`;
      const price = priceMap.get(symbol);

      return price ? sum + amount * price : sum;
    }, 0);
  }, [spotBalance, allSpotPrices]);

  const futuresUSDBalance = useMemo(() => {
    if (!futuresAssets || !allSpotPrices) return 0;

    const priceMap = new Map(
      allSpotPrices.map((p) => [p.symbol, parseFloat(p.price)]),
    );

    return futuresAssets.reduce((sum, b) => {
      const amount = parseFloat(b.walletBalance);

      if (['USDT', 'BUSD', 'USDC'].includes(b.asset)) {
        return sum + amount;
      }

      const symbol = `${b.asset}USDT`;
      const price = priceMap.get(symbol);

      return price ? sum + amount * price : sum;
    }, 0);
  }, [futuresAssets, allSpotPrices]);

  return {
    spotBalance,
    futuresAssets,
    spotUSDBalance,
    futuresUSDBalance,
    accountPnlData,
    futuresPositions,
    refetchFuturesPositions,
    isLoadingFuturesPositions,
  };
};

export default useDashboard;
