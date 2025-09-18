import mongoose from 'mongoose';
import logger from '../utils/Logger.js';

const connectDB = async (): Promise<void> => {
  try {
    const mongoUri: string =
      process.env.MONGODB_URI || 'mongodb://localhost:27017/crypto-trader-bot';

    await mongoose.connect(mongoUri);

    logger.success('MongoDB connected successfully');
  } catch (error) {
    logger.error('Failed to connect to MongoDB:', error);
    throw error;
  }
};

export default connectDB;
