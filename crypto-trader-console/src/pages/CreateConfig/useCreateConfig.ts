import { notifications } from '@mantine/notifications';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { createCoinConfig } from '../../api';
import { defaultPreset, presets, type PresetKey } from '../../presets';
import type { TCoinConfig } from '../../types';

const useCreateConfig = () => {
  const [selectedPreset, setSelectedPreset] = useState<PresetKey | null>(null);

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

  // Create default values from default preset with empty symbol
  const defaultValues = { ...defaultPreset, symbol: '' };

  const { register, handleSubmit, control, reset } = useForm<TCoinConfig>({
    defaultValues,
    shouldUnregister: true,
  });

  const onSubmit: SubmitHandler<TCoinConfig> = (data) => {
    createCoinConfigMutate(data);
  };

  const handlePresetChange = (value: string | null) => {
    const presetKey = value as PresetKey | null;
    setSelectedPreset(presetKey);
    if (presetKey && presetKey in presets) {
      const presetData = { ...presets[presetKey] };
      // Clear the symbol to let user set their own
      presetData.symbol = '';
      reset(presetData);
    } else {
      reset(defaultValues);
    }
  };

  return {
    register,
    handleSubmit,
    onSubmit,
    control,
    selectedPreset,
    handlePresetChange,
  };
};

export default useCreateConfig;
