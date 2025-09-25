import { createRoot } from 'react-dom/client';
import App from './App';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './index.css';
import { MantineProvider } from '@mantine/core';
import '@mantine/core/styles.css';

const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
  <MantineProvider
    theme={{
      fontFamily: 'Arial, sans-serif',
    }}
  >
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </MantineProvider>,
);
