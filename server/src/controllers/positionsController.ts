import { IPosition, PositionModel } from 'crypto-trader-db';
import { Request, Response } from 'express';
import logger from '../utils/Logger.js';
import { ApiErrorResponse } from './common.type.js';

// Response interface
interface PositionListResponse {
  success: boolean;
  message: string;
  data: IPosition[];
  count: number;
  timestamp: string;
}

// Get positions data by date range and symbol
const getPositionsByDateRangeAndSymbol = async (
  req: Request,
  res: Response<PositionListResponse | ApiErrorResponse>,
): Promise<void> => {
  try {
    const { symbol, dateFrom, dateTo } = req.query;

    if (!dateFrom || !dateTo) {
      res.status(400).json({
        error: 'Missing parameters',
        message: 'dateFrom and dateTo query parameters are required',
      });
      return;
    }

    logger.info(
      `Fetching closed positions history for symbol: ${symbol || 'all'} between ${dateFrom} and ${dateTo}`,
    );

    const startDate = new Date(dateFrom as string);
    const endDate = new Date(dateTo as string);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      res.status(400).json({
        error: 'Invalid timestamp format',
        message:
          'Please provide valid ISO timestamp strings for dateFrom and dateTo parameters',
      });
      return;
    }

    if (startDate >= endDate) {
      res.status(400).json({
        error: 'Invalid date range',
        message: 'dateFrom must be earlier than dateTo',
      });
      return;
    }

    // Find closed positions data within the timestamp range
    const query: any = {
      status: 'CLOSED',
      openedAt: { $gte: startDate, $lte: endDate },
    };

    // Only add symbol filter if provided
    if (symbol) {
      query.symbol = symbol;
    }

    const positionsData = await PositionModel.find(query).sort({ openedAt: 1 });

    logger.success(
      `Successfully fetched ${positionsData.length} closed position records for symbol: ${symbol || 'all'} between ${dateFrom} and ${dateTo}`,
    );

    res.json({
      success: true,
      message: `Closed positions history for symbol: ${symbol || 'all'} between ${dateFrom} and ${dateTo} retrieved successfully`,
      data: positionsData,
      count: positionsData.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error(
      `Error fetching closed positions history by date range and symbol for: ${req.query.symbol || 'all'}`,
      {
        message: error.message,
        stack: error.stack,
      },
    );

    res.status(500).json({
      error:
        'Failed to fetch closed positions history by date range and symbol',
      message: error.message,
    });
  }
};

export { getPositionsByDateRangeAndSymbol };
