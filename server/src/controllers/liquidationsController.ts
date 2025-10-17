import { ILiquidations, LiquidationsModel } from 'crypto-trader-db';
import { Request, Response } from 'express';
import type { FilterQuery } from 'mongoose';
import { DB_MAX_DOCUMENTS } from '../constants/database.js';
import { ApiErrorResponse, ApiResponse, ListResponse } from '../types/index.js';
import logger from '../utils/Logger.js';

/* ===================== Controllers ===================== */

// POST /liquidations - Save a liquidations document
export const saveLiquidations = async (
  req: Request,
  res: Response<ApiResponse | ApiErrorResponse>,
): Promise<void> => {
  try {
    const doc: ILiquidations = req.body;

    await LiquidationsModel.create(doc);

    // Clean up old documents if limit exceeded
    const count = await LiquidationsModel.countDocuments();
    if (count > DB_MAX_DOCUMENTS) {
      const oldest = await LiquidationsModel.find()
        .sort({ _id: 1 })
        .limit(count - DB_MAX_DOCUMENTS);
      const ids = oldest.map((d) => d._id);
      await LiquidationsModel.deleteMany({ _id: { $in: ids } });
      logger.info(
        `Cleaned up ${ids.length} old documents from liquidations collection`,
      );
    }

    logger.success('Successfully saved liquidations document');

    res.json({
      success: true,
      message: 'Liquidations document saved successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Error saving liquidations document:', {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });

    res.status(500).json({
      error: 'Failed to save liquidations document',
      message: errorMessage,
    });
  }
};

// GET /liquidations - Get liquidations documents
export const getLiquidations = async (
  req: Request,
  res: Response<ListResponse<ILiquidations> | ApiErrorResponse>,
): Promise<void> => {
  try {
    const { symbol, limit, dateFrom, dateTo } = req.query as {
      symbol?: string;
      limit?: string;
      dateFrom?: string;
      dateTo?: string;
    };

    // Build query with optional symbol and date range
    const query: FilterQuery<ILiquidations> = {};
    if (symbol) query.symbol = String(symbol);

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
      query.time = { $gte: startDate, $lte: endDate } as any;
    }

    const limitNum = Math.min(Number(limit ?? 100), 1000); // safety cap

    const docs = await LiquidationsModel.find(query)
      .sort({ time: -1, _id: -1 }) // latest first, stable tie-breaker
      .limit(limitNum)
      .lean()
      .exec();

    logger.success(
      `Loaded ${docs.length} liquidations docs (latest first by time)${symbol ? ` for symbol ${symbol}` : ''}${dateFrom ? ` from ${dateFrom} to ${dateTo}` : ''}`,
    );

    res.json({
      success: true,
      message: 'Liquidations documents loaded successfully',
      data: docs,
      count: docs.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Error loading liquidations documents:', {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });

    res.status(500).json({
      error: 'Failed to load liquidations documents',
      message: errorMessage,
    });
  }
};
