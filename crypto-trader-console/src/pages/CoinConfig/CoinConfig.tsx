import { type FC } from 'react';
import { CoinConfigTemplate } from '../../widgets';
import useCoinConfig from './useCoinConfig';

import styles from './CoinConfig.module.scss';
import { Button } from '@mantine/core';

const CoinConfig: FC = () => {
  const { isLoading, register, handleSubmit, onSubmit, symbol, control } =
    useCoinConfig();

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className={styles.wrapper}>
      <h2>Update {symbol} Config</h2>

      <form
        className={styles.wrapper__form}
        onSubmit={handleSubmit(onSubmit)}
        noValidate
      >
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
