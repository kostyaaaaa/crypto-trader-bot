import { Request, Response } from 'express';
import { getAccountSpotBalance } from '../api/spot/spot.js';
import { getAccountFuturesBalance } from '../api/futures/futures.js';
import { getPnL } from '../api/pnl/pnl.js';
import logger from '../utils/Logger.js';
import { ApiErrorResponse } from './common.type.js';
import { SpotAccountResponse } from '../api/spot/spot.type.js';
import { FuturesAccountResponse } from '../api/futures/futures.type.js';
import { PnLSummaryResponse } from '../api/pnl/pnl.type.js';

// Get spot account balance
const getSpotBalance = async (
  req: Request,
  res: Response<SpotAccountResponse | ApiErrorResponse>,
): Promise<void> => {
  try {
    logger.info('Fetching spot account balance');
    const balance = await getAccountSpotBalance();
    logger.success('Successfully fetched spot account balance');
    res.json(balance);
  } catch (error: any) {
    logger.error('Error fetching spot balance', {
      message: error.message,
      stack: error.stack,
    });
    res.status(500).json({
      error: 'Failed to fetch spot balance',
      message: error.message,
    } as ApiErrorResponse);
  }
};

// Get futures account balance
const getFuturesBalance = async (
  req: Request,
  res: Response<FuturesAccountResponse | ApiErrorResponse>,
): Promise<void> => {
  try {
    logger.info('Fetching futures account balance');
    const balance = await getAccountFuturesBalance();
    logger.success('Successfully fetched futures account balance');
    res.json(balance);
  } catch (error: any) {
    logger.error('Error fetching futures balance', {
      message: error.message,
      stack: error.stack,
    });
    res.status(500).json({
      error: 'Failed to fetch futures balance',
      message: error.message,
    } as ApiErrorResponse);
  }
};

// Get PnL data
const getAccountPnL = async (
  req: Request,
  res: Response<PnLSummaryResponse | ApiErrorResponse>,
): Promise<void> => {
  try {
    const daysBack: number = parseInt(req.query.days as string) || 1;
    logger.info(`Fetching PnL data for last ${daysBack} day(s)`);

    const pnlData = await getPnL(daysBack);
    logger.success(`Successfully fetched PnL data for last ${daysBack} day(s)`);
    res.json(pnlData);
  } catch (error: any) {
    logger.error('Error fetching PnL data', {
      message: error.message,
      stack: error.stack,
    });
    res.status(500).json({
      error: 'Failed to fetch PnL data',
      message: error.message,
    } as ApiErrorResponse);
  }
};

export { getSpotBalance, getFuturesBalance, getAccountPnL };
