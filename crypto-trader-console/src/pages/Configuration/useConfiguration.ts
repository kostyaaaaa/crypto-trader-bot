import { notifications } from '@mantine/notifications';
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
    onSuccess: (_, variables) => {
      refetch();
      notifications.show({
        title: 'Success!',
        message: `Configuration for ${variables} deleted successfully`,
        color: 'green',
      });
    },
    onError: (
      error: Error & { response?: { data?: { message?: string } } },
      variables,
    ) => {
      console.error('error:', error);
      notifications.show({
        title: 'Error',
        message:
          error?.response?.data?.message ||
          `Failed to delete configuration for ${variables}`,
        color: 'red',
      });
    },
  });

  return { configs: data?.data, deleteCoinConfigMutate };
};

export default useConfiguration;
