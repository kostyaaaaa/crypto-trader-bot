import type { FC } from 'react';
import { CoinConfigTemplate } from '../../widgets';
import useCreateConfig from './useCreateConfig';
import styles from './CreateConfig.module.scss';

const CreateConfig: FC = () => {
  const { register, handleSubmit, onSubmit } = useCreateConfig();

  return (
    <div className={styles.wrapper}>
      <h2>Create New Config</h2>

      <CoinConfigTemplate
        onSubmit={handleSubmit(onSubmit)}
        register={register}
      />
    </div>
  );
};

export default CreateConfig;
