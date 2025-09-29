import { Button, Select } from '@mantine/core';
import type { FC } from 'react';
import { presetOptions } from '../../presets';
import { CoinConfigTemplate } from '../../widgets';
import styles from './CreateConfig.module.scss';
import useCreateConfig from './useCreateConfig';

const CreateConfig: FC = () => {
  const {
    register,
    handleSubmit,
    onSubmit,
    control,
    selectedPreset,
    handlePresetChange,
  } = useCreateConfig();

  return (
    <div className={styles.wrapper}>
      <h2>Create New Config</h2>

      <div className={styles.presetSelector}>
        <Select
          label="Load from Preset"
          placeholder="Choose a trading preset template"
          data={presetOptions}
          value={selectedPreset}
          onChange={handlePresetChange}
          clearable
          searchable
          description="Select a preset to load predefined trading strategy values"
        />
      </div>

      <form
        className={styles.wrapper__form}
        onSubmit={handleSubmit(onSubmit)}
        noValidate
      >
        <CoinConfigTemplate register={register} control={control} />

        <Button type="submit" variant="gradient">
          Submit Config
        </Button>
      </form>
    </div>
  );
};

export default CreateConfig;
