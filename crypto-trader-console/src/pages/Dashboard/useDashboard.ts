import { useQuery } from '@tanstack/react-query';
import {
  QueryKeys,
  getAccountPnl,
  getCoinPrice,
  getFuturesBalance,
  getSpotBalance,
  type IgetFuturesBalanceResponse,
  type IgetSpotBalanceResponse,
} from '../../api';
import { useState } from 'react';

const useDashboard = () => {
  const [spotBalance, setSpotBalance] = useState<
    IgetSpotBalanceResponse['balances'] | null
  >(null);

  const [futuresBalance, setFuturesBalance] = useState<
    IgetFuturesBalanceResponse['positions'] | null
  >(null);

  const { data: accountPnlData } = useQuery({
    queryKey: [QueryKeys.AccountPnl],
    queryFn: async () => {
      const data = await getAccountPnl();
      return data;
    },
    refetchOnWindowFocus: false,
  });

  useQuery<IgetSpotBalanceResponse, Error>({
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

  useQuery<IgetFuturesBalanceResponse, Error>({
    queryKey: [QueryKeys.FuturesBalance],
    queryFn: async () => {
      const data = await getFuturesBalance();
      setFuturesBalance(
        data.positions.filter(
          // @ts-expect-error TODO: fix this
          (b) => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0,
        ),
      );

      return data;
    },
    refetchOnWindowFocus: false,
  });

  const { data: spotUSDBalance } = useQuery({
    queryKey: [QueryKeys.BinanceSpotPrice, spotBalance?.map((b) => b.asset)],
    queryFn: async () => {
      if (spotBalance && spotBalance.length <= 10) {
        const results = await Promise.allSettled(
          spotBalance.map((b) => getCoinPrice(b.asset)),
        );

        const total = spotBalance.reduce((sum, b, i) => {
          const amount = parseFloat(b.free) + parseFloat(b.locked);

          if (['USDT', 'BUSD', 'USDC'].includes(b.asset)) {
            return sum + amount;
          }

          const result = results[i];
          if (result.status === 'fulfilled') {
            const price = parseFloat(result.value.price);
            return sum + amount * price;
          }

          return sum;
        }, 0);

        return total ?? 0;
      } else {
        // return getAllPrices(); // NOT NEED NOW
      }
    },
    refetchOnWindowFocus: false,
    staleTime: 60_000, // 60 MIN TO REFRESH
    enabled: !!(spotBalance && spotBalance?.length > 0),
  });

  const { data: futuresUSDBalance } = useQuery({
    queryKey: [
      QueryKeys.BinanceFuturesPrice,
      futuresBalance?.map((b) => b.symbol),
    ],
    queryFn: async () => {
      if (futuresBalance && futuresBalance.length <= 10) {
        const results = await Promise.allSettled(
          futuresBalance.map((b) => getCoinPrice(b.symbol)),
        );

        const total = futuresBalance.reduce((sum, b, i) => {
          const amount = parseFloat(b.positionAmt);

          if (['USDT', 'BUSD', 'USDC'].includes(b.symbol)) {
            return sum + amount;
          }

          const result = results[i];
          if (result.status === 'fulfilled') {
            const price = parseFloat(result.value.price);
            return sum + amount * price;
          }

          return sum;
        }, 0);

        return total ?? 0;
      } else {
        // return getAllPrices(); // NOT NEED NOW
      }
    },
    refetchOnWindowFocus: false,
    staleTime: 60_000, // 60 MIN TO REFRESH
    enabled: !!(spotBalance && spotBalance?.length > 0),
  });

  return {
    spotBalance,
    futuresBalance,
    spotUSDBalance,
    futuresUSDBalance,
    accountPnlData,
  };
};

export default useDashboard;
