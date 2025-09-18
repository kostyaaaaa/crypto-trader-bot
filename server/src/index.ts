import express from 'express';
import dotenv from 'dotenv';
import globalRouter from './routes/index.js';
import logger from './utils/Logger.js';
import cors from 'cors';
import connectDB from './config/database.js';

dotenv.config();

const app = express();
// Environment variables are now properly typed
const PORT = parseInt(process.env.PORT || '5000', 10);

// Middleware
app.use(cors());
app.use(express.json());

// Use global router
app.use('/', globalRouter);

// Initialize database connection and start server
const startServer = async (): Promise<void> => {
  try {
    // Connect to MongoDB
    await connectDB();

    // Start server
    app.listen(PORT, () => {
      logger.success(`Server is running on port ${PORT}`, {
        environment: process.env.NODE_ENV || 'development',
      });
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
