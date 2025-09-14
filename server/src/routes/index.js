import express from 'express';
import accountRouter from './account.js';
import logger from '../utils/Logger.js';

const router = express.Router();

// Health check endpoint
router.get('/health', (req, res) => {
  try {
    logger.info('Health check requested');
    const healthData = {
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
  } catch (error) {
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
});

// Mount account routes
router.use('/account', accountRouter);

export default router;
