import { ILiquidity, LiquidityModel } from 'crypto-trader-db';
import { Request, Response } from 'express';
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
    const { symbol, limit } = req.query;

    const query = symbol ? { symbol } : {};
    const limitNum = limit ? parseInt(limit as string, 10) : 100;

    const docs = await LiquidityModel.find(query)
      .sort({ time: -1 })
      .limit(limitNum)
      .lean()
      .exec();

    logger.success(
      `Successfully loaded ${docs.length} liquidity documents${symbol ? ` for symbol ${symbol}` : ''}`,
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
