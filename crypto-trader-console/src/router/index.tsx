import { createBrowserRouter } from 'react-router-dom';
import { MainLayout } from '../layout';
import {
  Analysis,
  CoinConfig,
  Configuration,
  CreateConfig,
  Dashboard,
  Logs,
  PositionsPage,
} from '../pages';

import { ROUTERS_PATH } from './constants';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <MainLayout />,
    children: [
      { path: ROUTERS_PATH.dashboard, element: <Dashboard /> },
      { path: ROUTERS_PATH.configuration, element: <Configuration /> },
      { path: ROUTERS_PATH.createConfig, element: <CreateConfig /> },
      { path: ROUTERS_PATH.coinConfigIdPattern, element: <CoinConfig /> },
      { path: ROUTERS_PATH.positions, element: <PositionsPage /> },
      { path: ROUTERS_PATH.analysis, element: <Analysis /> },
      { path: ROUTERS_PATH.logs, element: <Logs /> },
    ],
  },
]);
