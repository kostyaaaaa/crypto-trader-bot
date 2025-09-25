export const ROUTERS_PATH = {
  dashboard: '/',
  configuration: '/configuration',
  createConfig: '/config/create',
  coinConfigIdPattern: '/config/create/:symbol',
  coinConfigId: (symbol: string) => `/config/create/${symbol}`,
} as const;
