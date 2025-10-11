import { AnalysisModel, IAnalysis } from 'crypto-trader-db';
import { Request, Response } from 'express';
import { DB_MAX_DOCUMENTS } from '../constants/database.js';
import { ApiErrorResponse, ApiResponse, ListResponse } from '../types/index.js';
import logger from '../utils/Logger.js';

// Get analysis data by date range and symbol
const getAnalysisByDateRangeAndSymbol = async (
  req: Request,
  res: Response<ListResponse<IAnalysis> | ApiErrorResponse>,
): Promise<void> => {
  try {
    const { symbol, dateFrom, dateTo } = req.query;

    if (!symbol || !dateFrom || !dateTo) {
      res.status(400).json({
        error: 'Missing parameters',
        message: 'symbol, dateFrom, and dateTo query parameters are required',
      });
      return;
    }

    const startDate = new Date(dateFrom as string);
    const endDate = new Date(dateTo as string);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      res.status(400).json({
        error: 'Invalid date format',
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

    // Find analysis data for the symbol within the date range
    const analysisData = await AnalysisModel.find({
      symbol,
      time: { $gte: startDate, $lte: endDate },
    }).sort({ time: 1 });

    logger.success(
      `Successfully fetched ${analysisData.length} analysis records for symbol: ${symbol} between ${dateFrom} and ${dateTo}`,
    );

    res.json({
      success: true,
      message: `Analysis data for ${symbol} between ${dateFrom} and ${dateTo} retrieved successfully`,
      data: analysisData,
      count: analysisData.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error(
      `Error fetching analysis data by date range and symbol for: ${req.query.symbol}`,
      {
        message: error.message,
        stack: error.stack,
      },
    );

    res.status(500).json({
      error: 'Failed to fetch analysis data by date range and symbol',
      message: error.message,
    });
  }
};

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

    logger.success('Successfully saved analysis document');

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

// GET /analytics - Get analysis documents
const getAnalysis = async (
  req: Request,
  res: Response<ListResponse<IAnalysis> | ApiErrorResponse>,
): Promise<void> => {
  try {
    const { symbol, limit } = req.query;

    const query = symbol ? { symbol } : {};
    const limitNum = limit ? parseInt(limit as string, 10) : 100;

    const docs = await AnalysisModel.find(query)
      .sort({ time: -1 })
      .limit(limitNum)
      .lean()
      .exec();

    logger.success(
      `Successfully loaded ${docs.length} analysis documents${symbol ? ` for symbol ${symbol}` : ''}`,
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

export { getAnalysis, getAnalysisByDateRangeAndSymbol, saveAnalysis };
