declare global {
  namespace NodeJS {
    interface ProcessEnv {
      // Server configuration
      NODE_ENV?: 'development' | 'production' | 'test';
      PORT?: string;

      // MongoDB configuration
      MONGODB_URI?: string;

      // Binance API configuration
      BINANCE_API_KEY?: string;
      BINANCE_ACCOUNT_SECRET_KEY?: string;

      // Telegram configuration
      TG_TOKEN?: string;
      TG_CHAT_ID?: string;

      // Frontend URL for position links
      FRONTEND_URL?: string;

      // Optional additional environment variables
      LOG_LEVEL?: 'debug' | 'info' | 'warn' | 'error';
      API_TIMEOUT?: string;
    }
  }
}

export {};
