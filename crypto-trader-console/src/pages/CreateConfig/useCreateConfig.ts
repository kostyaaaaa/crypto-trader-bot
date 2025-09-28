import { notifications } from '@mantine/notifications';
import { useMutation } from '@tanstack/react-query';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { createCoinConfig } from '../../api';
import type { TCoinConfig } from '../../types';
import { mockCreateConfigData } from './mock';

const useCreateConfig = () => {
  const { mutate: createCoinConfigMutate } = useMutation({
    mutationFn: createCoinConfig,
    onSuccess: (data) => {
      notifications.show({
        title: 'Success!',
        message: `Configuration for ${data.data.symbol} created successfully`,
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
          error?.response?.data?.message || 'Failed to create configuration',
        color: 'red',
      });
    },
  });

  const { register, handleSubmit, control } = useForm<TCoinConfig>({
    defaultValues: mockCreateConfigData,
    shouldUnregister: true,
  });
  const onSubmit: SubmitHandler<TCoinConfig> = (data) => {
    createCoinConfigMutate(data);
  };

  return { register, handleSubmit, onSubmit, control };
};

export default useCreateConfig;
