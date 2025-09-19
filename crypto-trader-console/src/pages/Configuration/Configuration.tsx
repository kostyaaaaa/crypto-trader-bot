import type { FC } from 'react';
import useConfiguration from './useConfiguration';

const Configuration: FC = () => {
  const { data } = useConfiguration();
  // test
  console.log('data', data);
  return <div>Configuration</div>;
};

export default Configuration;
