import { notifications } from '@mantine/notifications';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { useParams } from 'react-router-dom';
import {
  QueryKeys,
  binanceCoinsConfig,
  getConfigBySymbol,
  type IBinanceCoinsConfigResponse,
} from '../../api';
import { updateCoinConfig } from '../../api/coinConfig/updateCoinConfig';
import type { TCoinConfig } from '../../types';

const useCoinConfig = () => {
  const { symbol } = useParams<{ symbol: string }>();
  const [symbolList, setSymbolList] = useState<string[]>([]);

  const { data: coinConfigData, isLoading } = useQuery({
    queryKey: [QueryKeys.GetCoinConfig],
    queryFn: () => {
      if (symbol) {
        return getConfigBySymbol(symbol);
      }
    },
    refetchOnWindowFocus: false,
    retry: false,
  });

  const { mutate: updateCoinConfigMutate } = useMutation({
    mutationFn: updateCoinConfig,
    onSuccess: (data) => {
      notifications.show({
        title: 'Success!',
        message: `Configuration for ${data.data.symbol} updated successfully`,
        color: 'green',
      });
    },
    onError: (
      error: Error & { response?: { data?: { message?: string } } },
    ) => {
      console.error('error:', error);
      notifications.show({
        title: 'Error',
        message:
          error?.response?.data?.message || 'Failed to update configuration',
        color: 'red',
      });
    },
  });

  const { register, handleSubmit, reset, control } = useForm<TCoinConfig>({
    defaultValues: {},
  });

  useEffect(() => {
    if (coinConfigData?.data) {
      reset(coinConfigData?.data);
    }
  }, [coinConfigData?.data, reset]);

  const onSubmit: SubmitHandler<TCoinConfig> = (data) => {
    updateCoinConfigMutate(data);
  };
  useQuery<IBinanceCoinsConfigResponse, Error>({
    queryKey: [QueryKeys.SpotBalance],
    queryFn: async () => {
      const data = await binanceCoinsConfig();
      const updateSymbolList = data.symbols.map((s) => s.symbol);
      setSymbolList(updateSymbolList);
      return data;
    },
    refetchOnWindowFocus: false,
  });
  return {
    isLoading,
    register,
    handleSubmit,
    onSubmit,
    symbol,
    control,
    symbolList,
  };
};

export default useCoinConfig;
