import { notifications } from '@mantine/notifications';
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

  const { mutate: updateCoinConfigMutate } = useMutation({
    mutationFn: updateCoinConfig,
    onError: (error) => {
      console.error('error:', error);
    },
    onSuccess: (data) => {
      notifications.show({
        title: 'Success!',
        message: `Configuration for ${data.data.symbol} updated successfully`,
        color: 'green',
      });
      refetch();
    },
  });

  return {
    configs: data?.data,
    deleteCoinConfigMutate,
    updateCoinConfigMutate,
  };
};

export default useConfiguration;
