import { createBrowserRouter } from 'react-router-dom';
import { Configuration, Dashboard } from '../pages';
import { MainLayout } from '../layout';
import { ROUTERS_PATH } from './constants';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <MainLayout />,
    children: [
      { path: ROUTERS_PATH.dashboard, element: <Dashboard /> },
      { path: ROUTERS_PATH.configuration, element: <Configuration /> },
    ],
  },
]);
