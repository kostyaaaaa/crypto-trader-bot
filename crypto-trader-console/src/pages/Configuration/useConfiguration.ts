import { useQuery } from '@tanstack/react-query';
import { QueryKeys, getAllCoinConfigs } from '../../api';

const useConfiguration = () => {
  const { data } = useQuery({
    queryKey: [QueryKeys.AllCoinConfigs],
    queryFn: getAllCoinConfigs,
    refetchOnWindowFocus: false,
    retry: false,
  });

  return { configs: data?.data };
};

export default useConfiguration;
