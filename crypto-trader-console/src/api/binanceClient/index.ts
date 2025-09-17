import axios, { type InternalAxiosRequestConfig } from 'axios';

const axiosBinanceInterceptor = axios.create({
  baseURL: import.meta.env.VITE_BINANCE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

axiosBinanceInterceptor.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    return config;
  },
);

export default axiosBinanceInterceptor;
