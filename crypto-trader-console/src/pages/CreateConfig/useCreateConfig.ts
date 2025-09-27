import { useMutation } from '@tanstack/react-query';
import { createCoinConfig } from '../../api';
import { useForm, type SubmitHandler } from 'react-hook-form';
import type { TCoinConfig } from '../../types';
import { mockCreateConfigData } from './mock';

const useCreateConfig = () => {
  const { mutate: createCoinConfigMutate } = useMutation({
    mutationFn: createCoinConfig,
    onError: (error) => {
      console.error('error:', error);
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
