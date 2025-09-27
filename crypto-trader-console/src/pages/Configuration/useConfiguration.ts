import { useMutation, useQuery } from '@tanstack/react-query';
import { QueryKeys, deleteCoinConfig, getAllCoinConfigs } from '../../api';

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

  return { configs: data?.data, deleteCoinConfigMutate };
};

export default useConfiguration;
