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

// Get positions data by time and symbol
const getPositionsByTimeAndSymbol = async (
  req: Request,
  res: Response<PositionListResponse | ApiErrorResponse>,
): Promise<void> => {
  try {
    const { symbol, time } = req.query;

    if (!symbol || !time) {
      res.status(400).json({
        error: 'Missing parameters',
        message: 'Both symbol and time query parameters are required',
      });
      return;
    }

    logger.info(
      `Fetching positions data for symbol: ${symbol} with openedAt > ${time}`,
    );

    const positionTime = parseInt(time as string);

    if (isNaN(positionTime)) {
      res.status(400).json({
        error: 'Invalid time format',
        message: 'Please provide a valid timestamp (number) for time parameter',
      });
      return;
    }

    // Find positions data for the symbol where openedAt is greater than provided time
    const positionsData = await PositionModel.findBySymbolAndTimeGreaterThan(
      symbol as string,
      positionTime,
    );

    logger.success(
      `Successfully fetched ${positionsData.length} position records for symbol: ${symbol} with openedAt > ${time}`,
    );

    res.json({
      success: true,
      message: `Positions data for ${symbol} with openedAt > ${time} retrieved successfully`,
      data: positionsData,
      count: positionsData.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error(
      `Error fetching positions data by time and symbol for: ${req.query.symbol}`,
      {
        message: error.message,
        stack: error.stack,
      },
    );

    res.status(500).json({
      error: 'Failed to fetch positions data by time and symbol',
      message: error.message,
    });
  }
};

export { getPositionsByTimeAndSymbol };
