import { ILiquidity, LiquidityModel } from 'crypto-trader-db';
import { Request, Response } from 'express';
import type { FilterQuery } from 'mongoose';
import { DB_MAX_DOCUMENTS } from '../constants/database.js';
import { ApiErrorResponse, ApiResponse, ListResponse } from '../types/index.js';
import logger from '../utils/Logger.js';

/* ===================== Controllers ===================== */

// POST /liquidity - Save a liquidity document
export const saveLiquidity = async (
  req: Request,
  res: Response<ApiResponse | ApiErrorResponse>,
): Promise<void> => {
  try {
    const doc: ILiquidity = req.body;

    await LiquidityModel.create(doc);

    // Clean up old documents if limit exceeded
    const count = await LiquidityModel.countDocuments();
    if (count > DB_MAX_DOCUMENTS) {
      const oldest = await LiquidityModel.find()
        .sort({ _id: 1 })
        .limit(count - DB_MAX_DOCUMENTS);
      const ids = oldest.map((d) => d._id);
      await LiquidityModel.deleteMany({ _id: { $in: ids } });
      logger.info(
        `Cleaned up ${ids.length} old documents from liquidity collection`,
      );
    }

    logger.success('Successfully saved liquidity document');

    res.json({
      success: true,
      message: 'Liquidity document saved successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Error saving liquidity document:', {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });

    res.status(500).json({
      error: 'Failed to save liquidity document',
      message: errorMessage,
    });
  }
};

// GET /liquidity - Get liquidity documents
export const getLiquidity = async (
  req: Request,
  res: Response<ListResponse<ILiquidity> | ApiErrorResponse>,
): Promise<void> => {
  try {
    const { symbol, limit, dateFrom, dateTo } = req.query as {
      symbol?: string;
      limit?: string;
      dateFrom?: string;
      dateTo?: string;
    };

    const query: FilterQuery<ILiquidity> = {};
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

    const docs = await LiquidityModel.find(query)
      .sort({ time: -1, _id: -1 }) // latest first, stable tie-breaker
      .limit(limitNum)
      .lean()
      .exec();

    logger.success(
      `Loaded ${docs.length} liquidity docs (latest first by time)${symbol ? ` for symbol ${symbol}` : ''}${dateFrom ? ` from ${dateFrom} to ${dateTo}` : ''}`,
    );

    res.json({
      success: true,
      message: 'Liquidity documents loaded successfully',
      data: docs,
      count: docs.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Error loading liquidity documents:', {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });

    res.status(500).json({
      error: 'Failed to load liquidity documents',
      message: errorMessage,
    });
  }
};
