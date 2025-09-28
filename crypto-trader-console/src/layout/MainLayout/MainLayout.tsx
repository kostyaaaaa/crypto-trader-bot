import type { FC } from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from '../../widgets';

const MainLayout: FC = () => {
  return (
    <div style={{ width: '100%', maxWidth: '100vw', overflowX: 'hidden' }}>
      <Header />
      <Outlet />
    </div>
  );
};

export default MainLayout;
