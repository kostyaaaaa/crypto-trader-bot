import { CandleModel, ICandle } from 'crypto-trader-db';
import { Request, Response } from 'express';
import type { FilterQuery } from 'mongoose';
import { DB_MAX_DOCUMENTS } from '../constants/database.js';
import {
  ApiErrorResponse,
  DataResponse,
  ListResponse,
} from '../types/index.js';
import logger from '../utils/Logger.js';

/* ===================== Controllers ===================== */

// POST /candles - Save a candle document
export const saveCandle = async (
  req: Request,
  res: Response<DataResponse<{ id: any }> | ApiErrorResponse>,
): Promise<void> => {
  try {
    const candleData = req.body;

    // Валідація обов'язкових полів
    const requiredFields = [
      'symbol',
      'timeframe',
      'time',
      'open',
      'high',
      'low',
      'close',
      'volume',
    ];
    for (const field of requiredFields) {
      if (!candleData[field]) {
        res.status(400).json({
          error: 'Missing required field',
          message: `Missing required field: ${field}`,
        });
        return;
      }
    }

    // Перевіряємо чи свічка вже існує
    const existingCandle = await CandleModel.findOne({
      symbol: candleData.symbol,
      timeframe: candleData.timeframe,
      time: new Date(candleData.time),
    });

    if (existingCandle) {
      // Оновлюємо існуючу свічку
      await CandleModel.updateOne(
        { _id: existingCandle._id },
        { $set: candleData },
      );

      res.json({
        success: true,
        message: 'Candle updated',
        data: { id: existingCandle._id },
        timestamp: new Date().toISOString(),
      });
    } else {
      // Створюємо нову свічку
      const candle = new CandleModel(candleData);
      await candle.save();

      res.json({
        success: true,
        message: 'Candle created',
        data: { id: candle._id },
        timestamp: new Date().toISOString(),
      });
    }

    // Clean up old documents if limit exceeded
    const count = await CandleModel.countDocuments();
    if (count > DB_MAX_DOCUMENTS) {
      const oldest = await CandleModel.find()
        .sort({ _id: 1 })
        .limit(count - DB_MAX_DOCUMENTS);
      const ids = oldest.map((d) => d._id);
      await CandleModel.deleteMany({ _id: { $in: ids } });
      logger.info(
        `Cleaned up ${ids.length} old documents from candles collection`,
      );
    }

    logger.success('Successfully saved candle document');
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Error saving candle document:', {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });

    res.status(500).json({
      error: 'Failed to save candle document',
      message: errorMessage,
    });
  }
};

// GET /candles - Get candles documents
export const getCandles = async (
  req: Request,
  res: Response<ListResponse<ICandle> | ApiErrorResponse>,
): Promise<void> => {
  try {
    const { symbol, timeframe, limit, dateFrom, dateTo } = req.query as {
      symbol?: string;
      timeframe?: string;
      limit?: string;
      dateFrom?: string;
      dateTo?: string;
    };

    if (!symbol || !timeframe) {
      res.status(400).json({
        error: 'Missing required parameters',
        message: 'Symbol and timeframe are required',
      });
      return;
    }

    // Build query with symbol, timeframe and optional date range
    const query: FilterQuery<ICandle> = { symbol, timeframe };

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

    const candles = await CandleModel.find(query)
      .sort({ time: -1, _id: -1 }) // latest first, stable tie-breaker
      .limit(limitNum)
      .lean()
      .exec();

    logger.success(
      `Loaded ${candles.length} candles for ${symbol}@${timeframe}${dateFrom ? ` from ${dateFrom} to ${dateTo}` : ''}`,
    );

    res.json({
      success: true,
      message: 'Candles loaded successfully',
      data: candles.reverse(), // Повертаємо в хронологічному порядку
      count: candles.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Error loading candles documents:', {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });

    res.status(500).json({
      error: 'Failed to load candles documents',
      message: errorMessage,
    });
  }
};

// POST /candles/batch - Save multiple candles at once
export const saveCandlesBatch = async (
  req: Request,
  res: Response<
    DataResponse<{ saved: number; updated: number }> | ApiErrorResponse
  >,
): Promise<void> => {
  try {
    const candlesData: ICandle[] = req.body;

    if (!Array.isArray(candlesData) || candlesData.length === 0) {
      res.status(400).json({
        error: 'Invalid request body',
        message: 'Request body must be a non-empty array of candles',
      });
      return;
    }

    // Валідація обов'язкових полів для кожної свічки
    const requiredFields = [
      'symbol',
      'timeframe',
      'time',
      'open',
      'high',
      'low',
      'close',
      'volume',
    ];

    for (let i = 0; i < candlesData.length; i++) {
      const candle = candlesData[i];
      for (const field of requiredFields) {
        if (!(candle as any)[field]) {
          res.status(400).json({
            error: 'Missing required field',
            message: `Missing required field '${field}' in candle at index ${i}`,
          });
          return;
        }
      }
    }

    let savedCount = 0;
    let updatedCount = 0;

    // Використовуємо bulkWrite для ефективного збереження
    const bulkOps = candlesData.map((candleData) => ({
      updateOne: {
        filter: {
          symbol: candleData.symbol,
          timeframe: candleData.timeframe,
          time: new Date(candleData.time),
        },
        update: { $set: candleData },
        upsert: true, // Створюємо якщо не існує
      },
    }));

    const result = await CandleModel.bulkWrite(bulkOps);
    savedCount = result.upsertedCount;
    updatedCount = result.modifiedCount;

    // Clean up old documents if limit exceeded
    const count = await CandleModel.countDocuments();
    if (count > DB_MAX_DOCUMENTS) {
      const oldest = await CandleModel.find()
        .sort({ _id: 1 })
        .limit(count - DB_MAX_DOCUMENTS);
      const ids = oldest.map((d) => d._id);
      await CandleModel.deleteMany({ _id: { $in: ids } });
      logger.info(
        `Cleaned up ${ids.length} old documents from candles collection`,
      );
    }

    logger.success(
      `Successfully saved ${savedCount} new candles and updated ${updatedCount} existing candles`,
    );

    res.json({
      success: true,
      message: 'Candles batch saved successfully',
      data: { saved: savedCount, updated: updatedCount },
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Error saving candles batch:', {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });

    res.status(500).json({
      error: 'Failed to save candles batch',
      message: errorMessage,
    });
  }
};
