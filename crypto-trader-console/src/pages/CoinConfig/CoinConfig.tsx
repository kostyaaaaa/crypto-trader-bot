import { ArrowLeftIcon } from '@phosphor-icons/react';
import { type FC } from 'react';
import { Controller } from 'react-hook-form';
import { ROUTERS_PATH } from '../../router/constants';
import { CoinConfigTemplate } from '../../widgets';
import useCoinConfig from './useCoinConfig';

import { Autocomplete, Button, Checkbox } from '@mantine/core';
import styles from './CoinConfig.module.scss';

const CoinConfig: FC = () => {
  const {
    isLoading,
    register,
    handleSubmit,
    onSubmit,
    symbol,
    control,
    symbolList,
  } = useCoinConfig();

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className={styles.wrapper}>
      <div className={styles.back_btn}>
        <Button component="a" href={ROUTERS_PATH.configuration} variant="white">
          <ArrowLeftIcon size={24} style={{ marginRight: '8px' }} />{' '}
          Configuration list
        </Button>
      </div>
      <form
        className={styles.wrapper__form}
        onSubmit={handleSubmit(onSubmit)}
        noValidate
      >
        <h2>Update {symbol} Config</h2>
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
                disabled={true}
              />
            )}
          />

          <Checkbox
            className={styles.wrapper__checkbox}
            label="Is active"
            {...register('isActive')}
          />
          <Checkbox
            className={styles.wrapper__checkbox}
            label="Is trader"
            {...register('isTrader')}
          />
        </div>
        <CoinConfigTemplate
          register={register}
          disabledSymbol
          control={control}
        />

        <Button type="submit" variant="gradient">
          Submit Config
        </Button>
      </form>
    </div>
  );
};

export default CoinConfig;
