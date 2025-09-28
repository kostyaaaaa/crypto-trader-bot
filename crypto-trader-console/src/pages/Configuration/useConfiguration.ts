import { useMutation, useQuery } from '@tanstack/react-query';
import { QueryKeys, deleteCoinConfig, getAllCoinConfigs } from '../../api';
import { updateCoinConfig } from '../../api/coinConfig/updateCoinConfig';

const useConfiguration = () => {
  const { data, refetch } = useQuery({
    queryKey: [QueryKeys.AllCoinConfigs],
    queryFn: getAllCoinConfigs,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const { mutate: deleteCoinConfigMutate } = useMutation({
    mutationFn: deleteCoinConfig,
    onSuccess: () => {
      refetch();
    },
    onError: (error) => {
      console.error('error:', error);
    },
  });

  const { mutate: updateCoinConfigMutate } = useMutation({
    mutationFn: updateCoinConfig,
    onError: (error) => {
      console.error('error:', error);
    },
  });

  return {
    configs: data?.data,
    deleteCoinConfigMutate,
    updateCoinConfigMutate,
  };
};

export default useConfiguration;
