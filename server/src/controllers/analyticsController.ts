import { AnalysisModel, IAnalysis } from 'crypto-trader-db';
import { Request, Response } from 'express';
import logger from '../utils/Logger.js';
import { ApiErrorResponse } from './common.type.js';

// Response interface
interface AnalysisListResponse {
  success: boolean;
  message: string;
  data: IAnalysis[];
  count: number;
  timestamp: string;
}

// Get analysis data by date range and symbol
const getAnalysisByDateRangeAndSymbol = async (
  req: Request,
  res: Response<AnalysisListResponse | ApiErrorResponse>,
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

export { getAnalysisByDateRangeAndSymbol };
