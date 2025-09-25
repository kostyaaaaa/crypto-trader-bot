import { type FC } from 'react';
import { CoinConfigTemplate } from '../../widgets';
import useCoinConfig from './useCoinConfig';

import styles from './CoinConfig.module.scss';

const CoinConfig: FC = () => {
  const { isLoading, register, handleSubmit, onSubmit, symbol } =
    useCoinConfig();

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className={styles.wrapper}>
      <h2>Update {symbol} Config</h2>

      <CoinConfigTemplate
        onSubmit={handleSubmit(onSubmit)}
        register={register}
        disabledSymbol
      />
    </div>
  );
};

export default CoinConfig;
