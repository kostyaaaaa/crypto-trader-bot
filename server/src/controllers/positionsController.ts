import { IPosition, PositionModel } from 'crypto-trader-db';
import { Request, Response } from 'express';
import {
  cancelStopOrders,
  closePosition as closeBinancePosition,
  getPosition,
} from '../api/binance/trading.js';
import { notifyPositionClosed } from '../services/notificationService.js';
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
    const query: Record<string, unknown> = {
      status: 'CLOSED',
      closedAt: { $gte: startDate, $lte: endDate },
    };

    // Only add symbol filter if provided
    if (symbol) {
      query.symbol = symbol;
    }

    const positionsData = await PositionModel.find(query)
      .populate('analysis')
      .sort({
        closedAt: -1,
      });

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
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(
      `Error fetching closed positions history by date range and symbol for: ${req.query.symbol || 'all'}`,
      {
        message: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
      },
    );

    res.status(500).json({
      error:
        'Failed to fetch closed positions history by date range and symbol',
      message: errorMessage,
    });
  }
};

// Close position response interface
interface ClosePositionResponse {
  success: boolean;
  message: string;
  data?: {
    symbol: string;
    side: string;
    size: number;
    finalPnl: number;
    binanceOrderId: number;
  };
  timestamp: string;
}

// Close a position
const closePosition = async (
  req: Request,
  res: Response<ClosePositionResponse | ApiErrorResponse>,
): Promise<void> => {
  try {
    const { symbol } = req.body;

    if (!symbol) {
      res.status(400).json({
        error: 'Missing parameters',
        message: 'symbol is required in request body',
      });
      return;
    }

    // Find the open position in MongoDB
    const openPosition = await PositionModel.findOne({
      symbol,
      status: 'OPEN',
    });

    if (!openPosition) {
      res.status(404).json({
        error: 'Position not found',
        message: `No open position found for symbol ${symbol}`,
      });
      return;
    }

    // Get current position from Binance
    const binancePosition = await getPosition(symbol);
    if (!binancePosition || parseFloat(binancePosition.positionAmt) === 0) {
      res.status(404).json({
        error: 'Position not found',
        message: `No active position found on Binance for symbol ${symbol}`,
      });
      return;
    }

    const positionSize = Math.abs(parseFloat(binancePosition.positionAmt));
    const positionSide =
      parseFloat(binancePosition.positionAmt) > 0 ? 'LONG' : 'SHORT';

    // Cancel all stop orders first
    await cancelStopOrders(symbol);
    logger.info(`Canceled stop orders for ${symbol}`);

    // Close the position on Binance
    const closeResult = await closeBinancePosition(
      symbol,
      positionSide,
      positionSize,
    );
    logger.info(`Closed position on Binance for ${symbol}:`, closeResult);

    // Calculate final PnL (this is a simplified calculation)
    const entryPrice = parseFloat(binancePosition.entryPrice);
    const currentPrice = parseFloat(binancePosition.markPrice);
    const pnl =
      positionSide === 'LONG'
        ? (currentPrice - entryPrice) * positionSize
        : (entryPrice - currentPrice) * positionSize;

    // Update position in MongoDB
    const updatedPosition = await PositionModel.findByIdAndUpdate(
      openPosition._id,
      {
        status: 'CLOSED',
        closedAt: new Date(),
        closedBy: 'MANUAL',
        finalPnl: pnl,
      },
      { new: true },
    );

    if (!updatedPosition) {
      throw new Error('Failed to update position in database');
    }

    // Send Telegram notification
    await notifyPositionClosed(updatedPosition);
    logger.info(`Sent Telegram notification for closed position ${symbol}`);

    logger.success(`Successfully closed position for ${symbol}`);

    res.json({
      success: true,
      message: `Position ${symbol} closed successfully`,
      data: {
        symbol,
        side: positionSide,
        size: positionSize,
        finalPnl: pnl,
        binanceOrderId: closeResult.orderId,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error closing position:`, {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });

    res.status(500).json({
      error: 'Failed to close position',
      message: errorMessage,
    });
  }
};

export { closePosition, getPositionsByDateRangeAndSymbol };
