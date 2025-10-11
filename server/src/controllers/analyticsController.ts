import { AnalysisModel, IAnalysis } from 'crypto-trader-db';
import { Request, Response } from 'express';
import type { FilterQuery } from 'mongoose';
import { DB_MAX_DOCUMENTS } from '../constants/database.js';
import { ApiErrorResponse, ApiResponse, ListResponse } from '../types/index.js';
import logger from '../utils/Logger.js';

// Removed - functionality merged into getAnalysis

// POST /analysis - Save an analysis document
const saveAnalysis = async (
  req: Request,
  res: Response<ApiResponse | ApiErrorResponse>,
): Promise<void> => {
  try {
    const doc: IAnalysis = req.body;

    await AnalysisModel.create(doc);

    // Clean up old documents if limit exceeded
    const count = await AnalysisModel.countDocuments();
    if (count > DB_MAX_DOCUMENTS) {
      const oldest = await AnalysisModel.find()
        .sort({ _id: 1 })
        .limit(count - DB_MAX_DOCUMENTS);
      const ids = oldest.map((d) => d._id);
      await AnalysisModel.deleteMany({ _id: { $in: ids } });
      logger.info(
        `Cleaned up ${ids.length} old documents from analysis collection`,
      );
    }

    res.json({
      success: true,
      message: 'Analysis document saved successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Error saving analysis document:', {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });

    res.status(500).json({
      error: 'Failed to save analysis document',
      message: errorMessage,
    });
  }
};

// GET /analytics - Get analysis documents (with optional date range filtering)
const getAnalysis = async (
  req: Request,
  res: Response<ListResponse<IAnalysis> | ApiErrorResponse>,
): Promise<void> => {
  try {
    const { symbol, limit, dateFrom, dateTo } = req.query;

    // Build query object
    const query: FilterQuery<IAnalysis> = {};
    if (symbol) query.symbol = String(symbol);

    // If date range is provided, validate and add to query
    if (dateFrom || dateTo) {
      if (!dateFrom || !dateTo) {
        res.status(400).json({
          error: 'Missing parameters',
          message:
            'Both dateFrom and dateTo are required when using date filtering',
        });
        return;
      }

      const startDate = new Date(dateFrom as string);
      const endDate = new Date(dateTo as string);

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

      query.time = { $gte: startDate, $lte: endDate };
    }

    const limitNum = Math.min(Number(limit ?? 100), 1000);

    const docs = await AnalysisModel.find(query)
      .sort({ time: -1, _id: -1 })
      .limit(limitNum)
      .lean()
      .exec();

    logger.success(
      `Loaded ${docs.length} analysis docs (latest first by time)${symbol ? ` for symbol ${symbol}` : ''}${dateFrom ? ` from ${dateFrom} to ${dateTo}` : ''}`,
    );

    res.json({
      success: true,
      message: 'Analysis documents loaded successfully',
      data: docs,
      count: docs.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Error loading analysis documents:', {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });

    res.status(500).json({
      error: 'Failed to load analysis documents',
      message: errorMessage,
    });
  }
};

export { getAnalysis, saveAnalysis };
