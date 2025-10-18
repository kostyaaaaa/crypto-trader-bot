import axios from 'axios';
import type { ICandle } from 'crypto-trader-db';
import { getCandles, submitCandlesBatch } from '../api';
import logger from './db-logger';

/**
 * Отримує свічки з DB, а якщо недостатньо - робить HTTP запит для поповнення
 */
export async function getCandlesWithFallback(
  symbol: string,
  timeframe: string,
  limit: number = 100,
): Promise<ICandle[]> {
  try {
    // Спочатку пробуємо отримати з DB
    const dbCandles = await getCandles(symbol, timeframe, limit);

    // Якщо достатньо свічок - повертаємо
    if (dbCandles.length >= limit) {
      return dbCandles;
    }

    // Якщо недостатньо - робимо HTTP запит для поповнення
    logger.warn(
      `⚠️ Insufficient candles in DB for ${symbol}@${timeframe}: ${dbCandles.length}/${limit}. Making HTTP request...`,
    );

    const response = await axios.get(
      'https://fapi.binance.com/fapi/v1/klines',
      {
        params: { symbol, interval: timeframe, limit },
      },
    );

    const httpCandles: ICandle[] = response.data.map((k: any) => ({
      symbol,
      timeframe,
      time: new Date(k[0]),
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5]),
    }));

    // Зберігаємо HTTP свічки в DB для майбутнього використання
    logger.info(
      `💾 Saving ${httpCandles.length} HTTP candles to DB for ${symbol}@${timeframe}...`,
    );

    // Фільтруємо тільки нові свічки (яких немає в DB)
    const existingTimes = new Set(dbCandles.map((c) => c.time.getTime()));
    const newCandles = httpCandles.filter(
      (candle) => !existingTimes.has(candle.time.getTime()),
    );

    if (newCandles.length > 0) {
      // Зберігаємо тільки нові свічки масово
      try {
        const result = await submitCandlesBatch(newCandles);
        logger.success(
          `✅ Successfully saved ${result.saved} new candles and updated ${result.updated} existing candles for ${symbol}@${timeframe}`,
        );
      } catch (error: any) {
        logger.error(
          `❌ Failed to save HTTP candles to DB for ${symbol}@${timeframe}:`,
          error?.message || error,
        );
      }
    } else {
      logger.info(
        `ℹ️ All ${httpCandles.length} HTTP candles already exist in DB for ${symbol}@${timeframe}`,
      );
    }

    logger.info(
      `✅ Got ${httpCandles.length} candles from HTTP for ${symbol}@${timeframe}`,
    );
    return httpCandles;
  } catch (error: any) {
    logger.error(
      `❌ Failed to get candles for ${symbol}@${timeframe}:`,
      error?.message || error,
    );
    return [];
  }
}
