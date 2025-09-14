import express from 'express';
import dotenv from 'dotenv';
import globalRouter from './routes/index.js';
import logger from './utils/Logger.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());

// Use global router
app.use('/api', globalRouter);

// Start server
app.listen(PORT, () => {
  logger.success(`Server is running on port ${PORT}`, {
    environment: process.env.NODE_ENV || 'development',
  });
});
