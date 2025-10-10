import dotenv from 'dotenv';
import mongoose from 'mongoose';
import logger from '../utils/db-logger';

dotenv.config();

const connectDB = async () => {
  try {
    const mongoUri =
      process.env.MONGODB_URI || 'mongodb://localhost:27017/crypto-trader-bot';

    await mongoose.connect(mongoUri);

    logger.info('MongoDB connected successfully');
  } catch (error) {
    logger.error('Failed to connect to MongoDB:', error);
    throw error;
  }
};

export default connectDB;
