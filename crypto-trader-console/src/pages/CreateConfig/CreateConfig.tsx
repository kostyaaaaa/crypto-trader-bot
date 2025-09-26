import type { FC } from 'react';
import { CoinConfigTemplate } from '../../widgets';
import useCreateConfig from './useCreateConfig';
import styles from './CreateConfig.module.scss';
import { Button } from '@mantine/core';

const CreateConfig: FC = () => {
  const { register, handleSubmit, onSubmit, control } = useCreateConfig();

  return (
    <div className={styles.wrapper}>
      <h2>Create New Config</h2>

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
