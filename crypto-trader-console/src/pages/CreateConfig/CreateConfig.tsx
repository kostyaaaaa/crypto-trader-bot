import { Autocomplete, Button, Checkbox, Select } from '@mantine/core';
import { ArrowLeft } from '@phosphor-icons/react';
import type { FC } from 'react';
import { Controller } from 'react-hook-form';
import { presetOptions } from '../../constants/presets';
import { ROUTERS_PATH } from '../../router/constants';
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
    symbolList,
  } = useCreateConfig();

  return (
    <div className={styles.wrapper}>
      <div className={styles.back_btn}>
        <Button component="a" href={ROUTERS_PATH.configuration} variant="white">
          <ArrowLeft size={24} /> Counfiguration list
        </Button>
      </div>
      <form
        className={styles.wrapper__form}
        onSubmit={handleSubmit(onSubmit)}
        noValidate
      >
        <h2>Create New Config</h2>

        <div className={styles.wrapper__title}>
          <Controller
            name="symbol"
            control={control}
            render={({ field }) => (
              <Autocomplete
                {...field}
                label="Symbol"
                placeholder="Pick Symbol"
                data={symbolList}
                clearable
                disabled={false}
              />
            )}
          />
          <Checkbox
            className={styles.wrapper__checkbox}
            label="Is active"
            {...register('isActive')}
          />
          <div className={styles.presetSelector}>
            <Select
              label="Load from Preset"
              placeholder="Choose a trading preset template"
              data={presetOptions}
              value={selectedPreset}
              onChange={handlePresetChange}
              clearable
              searchable
            />
          </div>
        </div>

        <CoinConfigTemplate register={register} control={control} />

        <Button type="submit" variant="gradient">
          Submit Config
        </Button>
      </form>
    </div>
  );
};

export default CreateConfig;
