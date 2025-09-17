import axios, { type InternalAxiosRequestConfig } from 'axios';

const axiosInterceptor = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

axiosInterceptor.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    return config;
  },
);

export default axiosInterceptor;
