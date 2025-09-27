import { Request, Response } from 'express';
import { AnalysisModel, IAnalysis } from 'crypto-trader-db';
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

// Get analysis data by time and symbol
const getAnalysisByTimeAndSymbol = async (
  req: Request,
  res: Response<AnalysisListResponse | ApiErrorResponse>,
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
      `Fetching analysis data for symbol: ${symbol} with time > ${time}`,
    );

    const analysisTime = new Date(time as string);

    if (isNaN(analysisTime.getTime())) {
      res.status(400).json({
        error: 'Invalid date format',
        message: 'Please provide a valid ISO date string for time parameter',
      });
      return;
    }

    // Find analysis data for the symbol where time is greater than provided time
    const analysisData = await AnalysisModel.find({
      symbol,
      time: { $gt: analysisTime },
    }).sort({ time: 1 });

    logger.success(
      `Successfully fetched ${analysisData.length} analysis records for symbol: ${symbol} with time > ${time}`,
    );

    res.json({
      success: true,
      message: `Analysis data for ${symbol} with time > ${time} retrieved successfully`,
      data: analysisData,
      count: analysisData.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error(
      `Error fetching analysis data by time and symbol for: ${req.query.symbol}`,
      {
        message: error.message,
        stack: error.stack,
      },
    );

    res.status(500).json({
      error: 'Failed to fetch analysis data by time and symbol',
      message: error.message,
    });
  }
};

export { getAnalysisByTimeAndSymbol };
