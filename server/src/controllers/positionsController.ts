import { IPosition, PositionModel } from 'crypto-trader-db';
import { Request, Response } from 'express';
import type { FilterQuery } from 'mongoose';
import {
  cancelStopOrders,
  closePosition as closeBinancePosition,
  getPosition,
} from '../api/binance/trading.js';
import { DB_MAX_DOCUMENTS } from '../constants/database.js';
import { notifyPositionClosed } from '../services/notificationService.js';
import {
  ApiErrorResponse,
  ApiResponse,
  DataResponse,
  ListResponse,
  UpdateResponse,
} from '../types/index.js';
import logger from '../utils/Logger.js';

// Get positions data by date range and symbol
const getPositionsByDateRangeAndSymbol = async (
  req: Request,
  res: Response<ListResponse<IPosition> | ApiErrorResponse>,
): Promise<void> => {
  try {
    const { symbol, dateFrom, dateTo, limit } = req.query as {
      symbol?: string;
      dateFrom?: string;
      dateTo?: string;
      limit?: string;
    };

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
    const query: FilterQuery<IPosition> = {
      status: 'CLOSED',
      closedAt: { $gte: startDate, $lte: endDate } as any,
    };

    if (symbol) query.symbol = String(symbol);

    const limitNum = Math.min(Number(limit ?? 1000), 5000); // safety cap

    const positionsData = await PositionModel.find(query)
      .populate('analysis')
      .sort({ closedAt: -1, _id: -1 }) // latest first, stable tie-breaker
      .limit(limitNum)
      .lean()
      .exec();

    logger.success(
      `Fetched ${positionsData.length} CLOSED positions (latest first) for ${symbol || 'all'} between ${dateFrom} and ${dateTo}`,
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

// Close position data interface
interface ClosePositionData {
  symbol: string;
  side: string;
  size: number;
  finalPnl: number;
  binanceOrderId: number;
}

// Close a position
const closePosition = async (
  req: Request,
  res: Response<DataResponse<ClosePositionData> | ApiErrorResponse>,
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

    // Calculate final PnL using actual close price if available
    const entryPrice = parseFloat(binancePosition.entryPrice);
    const exitPriceStr =
      (closeResult as any)?.avgPrice ??
      (closeResult as any)?.price ??
      binancePosition.markPrice;
    const exitPrice =
      Number(exitPriceStr) || parseFloat(binancePosition.markPrice);

    const pnl =
      positionSide === 'LONG'
        ? (exitPrice - entryPrice) * positionSize
        : (entryPrice - exitPrice) * positionSize;

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

// POST /positions/save - Save a position document
const savePosition = async (
  req: Request,
  res: Response<ApiResponse | ApiErrorResponse>,
): Promise<void> => {
  try {
    const doc: IPosition = req.body;

    await PositionModel.create(doc);

    // Clean up old documents if limit exceeded
    const count = await PositionModel.countDocuments();
    if (count > DB_MAX_DOCUMENTS) {
      const oldest = await PositionModel.find()
        .sort({ _id: 1 })
        .limit(count - DB_MAX_DOCUMENTS);
      const ids = oldest.map((d) => d._id);
      await PositionModel.deleteMany({ _id: { $in: ids } });
      logger.info(
        `Cleaned up ${ids.length} old documents from positions collection`,
      );
    }

    logger.success('Successfully saved position document');

    res.json({
      success: true,
      message: 'Position document saved successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Error saving position document:', {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });

    res.status(500).json({
      error: 'Failed to save position document',
      message: errorMessage,
    });
  }
};

// GET /positions - Get position documents
const getPositions = async (
  req: Request,
  res: Response<ListResponse<IPosition> | ApiErrorResponse>,
): Promise<void> => {
  try {
    const { symbol, limit, status, dateFrom, dateTo } = req.query as {
      symbol?: string;
      limit?: string;
      status?: string;
      dateFrom?: string;
      dateTo?: string;
    };

    const query: FilterQuery<IPosition> = {};
    if (symbol) query.symbol = String(symbol);
    if (status) query.status = String(status).toUpperCase() as any; // OPEN/CLOSED

    if (dateFrom || dateTo) {
      if (!dateFrom || !dateTo) {
        res.status(400).json({
          error: 'Missing parameters',
          message:
            'Both dateFrom and dateTo are required when using date filtering',
        });
        return;
      }
      const startDate = new Date(dateFrom);
      const endDate = new Date(dateTo);
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        res.status(400).json({
          error: 'Invalid date format',
          message:
            'Please provide valid ISO timestamp strings for dateFrom and dateTo',
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
      // By default filter by openedAt; if you need closedAt, use the dedicated endpoint
      query.openedAt = { $gte: startDate, $lte: endDate } as any;
    }

    const limitNum = Math.min(Number(limit ?? 100), 1000);

    const docs = await PositionModel.find(query)
      .populate('analysis')
      .sort({ openedAt: -1, _id: -1 }) // latest first, stable
      .limit(limitNum)
      .lean()
      .exec();

    logger.success(
      `Successfully loaded ${docs.length} position documents${symbol ? ` for symbol ${symbol}` : ''}`,
    );

    res.json({
      success: true,
      message: 'Position documents loaded successfully',
      data: docs,
      count: docs.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Error loading position documents:', {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });

    res.status(500).json({
      error: 'Failed to load position documents',
      message: errorMessage,
    });
  }
};

// PATCH /positions/:id - Update a position document by ID
const updatePosition = async (
  req: Request,
  res: Response<UpdateResponse<IPosition> | ApiErrorResponse>,
): Promise<void> => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (!id) {
      res.status(400).json({
        error: 'Missing parameters',
        message: 'Position ID is required',
      });
      return;
    }

    const result = await PositionModel.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true },
    ).lean();

    logger.success('Successfully updated position document');

    res.json({
      success: true,
      message: 'Position document updated successfully',
      data: result ?? null,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Error updating position document:', {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });

    res.status(500).json({
      error: 'Failed to update position document',
      message: errorMessage,
    });
  }
};

export {
  closePosition,
  getPositions,
  getPositionsByDateRangeAndSymbol,
  savePosition,
  updatePosition,
};
