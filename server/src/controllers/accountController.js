import { getAccountSpotBalance } from '../api/spot.js';
import { getAccountFuturesBalance } from '../api/futures.js';
import logger from '../utils/Logger.js';

// Get spot account balance
const getSpotBalance = async (req, res) => {
  try {
    logger.info('Fetching spot account balance');
    const balance = await getAccountSpotBalance();
    logger.success('Successfully fetched spot account balance');
    res.json(balance);
  } catch (error) {
    logger.error('Error fetching spot balance', {
      message: error.message,
      stack: error.stack,
    });
    res.status(500).json({
      error: 'Failed to fetch spot balance',
      message: error.message,
    });
  }
};

// Get futures account balance
const getFuturesBalance = async (req, res) => {
  try {
    logger.info('Fetching futures account balance');
    const balance = await getAccountFuturesBalance();
    logger.success('Successfully fetched futures account balance');
    res.json(balance);
  } catch (error) {
    logger.error('Error fetching futures balance', {
      message: error.message,
      stack: error.stack,
    });
    res.status(500).json({
      error: 'Failed to fetch futures balance',
      message: error.message,
    });
  }
};

export { getSpotBalance, getFuturesBalance };
