import { useMutation, useQuery } from '@tanstack/react-query';
import { QueryKeys, getConfigBySymbol } from '../../api';
import { useParams } from 'react-router-dom';
import { updateCoinConfig } from '../../api/coinConfig/updateCoinConfig';
import { useForm, type SubmitHandler } from 'react-hook-form';
import type { TCoinConfig } from '../../types';
import { useEffect } from 'react';

const useCoinConfig = () => {
  const { symbol } = useParams<{ symbol: string }>();

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
    onError: (error) => {
      console.error('error:', error);
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

  return {
    isLoading,
    register,
    handleSubmit,
    onSubmit,
    symbol,
    control,
  };
};

export default useCoinConfig;
