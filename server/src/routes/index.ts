import express, { Request, Response } from 'express';
import accountRouter from './account.js';
import logger from '../utils/Logger.js';
import { ApiErrorResponse } from '../controllers/common.type.js';

const router = express.Router();

interface HealthData {
  status: string;
  message: string;
  uptime: number;
  timestamp: string;
  environment: string;
}

interface HealthResponse {
  success: boolean;
  message: string;
  data: HealthData;
  timestamp: string;
}

interface HealthErrorResponse extends ApiErrorResponse {
  timestamp: string;
}

// Health check endpoint
router.get(
  '/health',
  (req: Request, res: Response<HealthResponse | HealthErrorResponse>) => {
    try {
      logger.info('Health check requested');
      const healthData: HealthData = {
        status: 'OK',
        message: 'Crypto Trader Bot Server is running',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
      };

      res.json({
        success: true,
        message: 'Server is healthy',
        data: healthData,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      logger.error('Health check failed', {
        message: error.message,
        stack: error.stack,
      });
      res.status(500).json({
        error: 'Health check failed',
        message: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  },
);

// Mount account routes
router.use('/account', accountRouter);

export default router;
