// src/config/api-client.ts
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Base URL for the API server
 */
export const API_BASE_URL = process.env.SERVER_URL || 'http://localhost:5000';

/**
 * Configured axios instance for API requests
 */
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for logging (optional)
apiClient.interceptors.request.use(
  (config) => {
    // You can add auth headers, logging, etc. here
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // You can add global error handling here
    return Promise.reject(error);
  },
);
