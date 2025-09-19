import type { FC } from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from '../../widgets';

const MainLayout: FC = () => {
  return (
    <div>
      <Header />
      <Outlet />
    </div>
  );
};

export default MainLayout;
