import type { FC } from 'react';
import useConfiguration from './useConfiguration';
import { Button } from '@mantine/core';
import styles from './Configuration.module.scss';
import { ROUTERS_PATH } from '../../router/constants';

const Configuration: FC = () => {
  const { data } = useConfiguration();

  return (
    <div className={styles.configuration}>
      <Button
        variant="filled"
        m={12}
        component="a"
        href={ROUTERS_PATH.createConfig}
      >
        + Add new config
      </Button>

      <div>{!data?.data.length ? 'any configs' : 'have config'}</div>
    </div>
  );
};

export default Configuration;
