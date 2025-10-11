import { Request, Response } from 'express';
import { getAccountFuturesBalance } from '../api/futures/futures.js';
import { FuturesAccountResponse } from '../api/futures/futures.type.js';
import { getPnL } from '../api/pnl/pnl.js';
import { PnLSummaryResponse } from '../api/pnl/pnl.type.js';
import { ApiErrorResponse } from '../types/index.js';
import logger from '../utils/Logger.js';

// Get futures account balance
const getFuturesBalance = async (
  req: Request,
  res: Response<FuturesAccountResponse | ApiErrorResponse>,
): Promise<void> => {
  try {
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

export { getAccountPnL, getFuturesBalance };
