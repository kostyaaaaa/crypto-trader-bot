import { useQuery } from '@tanstack/react-query';
import { QueryKeys, getAllCoinConfigs } from '../../api';

const useConfiguration = () => {
  const { data } = useQuery({
    queryKey: [QueryKeys.AllCoinConfigs],
    queryFn: async () => {
      const data = await getAllCoinConfigs();
      return data;
    },
    refetchOnWindowFocus: false,
  });

  return { data };
};

export default useConfiguration;
