import { getAccountSpotBalance } from '../api/spot.js';
import { getAccountFuturesBalance } from '../api/futures.js';
import { getPnL } from '../api/pnl.js';
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

// Get PnL data
const getAccountPnL = async (req, res) => {
  try {
    const daysBack = parseInt(req.query.days) || 1;
    logger.info(`Fetching PnL data for last ${daysBack} day(s)`);

    const pnlData = await getPnL(daysBack);
    logger.success(`Successfully fetched PnL data for last ${daysBack} day(s)`);
    res.json(pnlData);
  } catch (error) {
    logger.error('Error fetching PnL data', {
      message: error.message,
      stack: error.stack,
    });
    res.status(500).json({
      error: 'Failed to fetch PnL data',
      message: error.message,
    });
  }
};

export { getSpotBalance, getFuturesBalance, getAccountPnL };
