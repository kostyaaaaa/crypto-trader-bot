import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { createServer } from 'http';
import connectDB from './config/database.js';
import globalRouter from './routes/index.js';
import { LogMonitorService } from './services/logMonitorService.js';
import { WebSocketService } from './services/websocketService.js';
import logger from './utils/Logger.js';

dotenv.config();

const app = express();
// Environment variables are now properly typed
const PORT = parseInt(process.env.PORT || '5000', 10);

// Middleware
app.use(cors());
app.use(express.json());

// Use global router
app.use('/', globalRouter);

// Create HTTP server
const server = createServer(app);

// Initialize database connection and start server
const startServer = async (): Promise<void> => {
  try {
    // Connect to MongoDB
    await connectDB();

    const websocketService = new WebSocketService(server);
    const logMonitorService = new LogMonitorService(websocketService);

    // Start server
    server.listen(PORT, () => {
      logger.success(`Server is running on port ${PORT}`, {
        environment: process.env.NODE_ENV || 'development',
      });
      logger.info(`WebSocket server is running on ws://localhost:${PORT}`);
    });

    // Graceful shutdown handling
    const shutdown = () => {
      logger.info('Shutdown signal received, shutting down gracefully');
      logMonitorService.stopMonitoring();
      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
