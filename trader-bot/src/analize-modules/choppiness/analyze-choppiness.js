// modules/choppiness/analyze-choppiness.js
// --- Аналіз Choppiness Index (CHOP) ---
// CHOP вимірює наскільки "flat" (choppy) або "trending" є ринок
// Формула: CHOP = 100 × (log10(Σ(i=1 to n) TR_i) - log10(MAX(High_n) - MIN(Low_n))) / log10(n)
// Значення близькі до 100 = flat market (noise)
// Значення близькі до 0 = strong trend
// У нашому випадку: чим більше score - тим краще (інвертуємо логіку)

import axios from 'axios';
import logger from '../../utils/db-logger.js';

export async function analyzeChoppiness(
  symbol = 'ETHUSDT',
  period = 10, // використовуємо 10 свічок як запитано
) {
  try {
    // --- отримуємо 1-хвилинні свічки з Binance ---
    const klineRes = await axios.get(
      'https://fapi.binance.com/fapi/v1/klines',
      {
        params: {
          symbol,
          interval: '1m', // завжди 1-хвилинні свічки
          limit: period + 1, // потрібно +1 для TR розрахунку
        },
      },
    );

    if (!klineRes.data || klineRes.data.length < period + 1) {
      logger.warn(
        `⚠️ Insufficient 1m candle data for ${symbol} choppiness analysis`,
      );
      return null;
    }

    // --- конвертуємо дані Binance в наш формат ---
    const candles = klineRes.data.map((k) => ({
      time: new Date(k[0]).toISOString(),
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5]),
    }));

    // --- беремо останні N+1 свічок (потрібно +1 для TR розрахунку) ---
    const recent = candles.slice(-(period + 1));

    // --- розрахунок True Range (TR) для кожної свічки ---
    const trs = [];
    for (let i = 1; i < recent.length; i++) {
      const curr = recent[i];
      const prev = recent[i - 1];

      const hl = curr.high - curr.low;
      const hc = Math.abs(curr.high - prev.close);
      const lc = Math.abs(curr.low - prev.close);

      trs.push(Math.max(hl, hc, lc));
    }

    // --- знаходимо MAX(High_n) та MIN(Low_n) за період ---
    const highs = recent.slice(1).map((c) => c.high); // виключаємо першу свічку для TR
    const lows = recent.slice(1).map((c) => c.low);
    const maxHigh = Math.max(...highs);
    const minLow = Math.min(...lows);
    const highLowRange = maxHigh - minLow;

    // --- розрахунок CHOP за формулою ---
    const sumTR = trs.reduce((sum, tr) => sum + tr, 0);

    // Перевіряємо на випадок ділення на нуль або логарифм від нуля/негативного числа
    if (sumTR <= 0 || highLowRange <= 0 || period <= 0) {
      return {
        module: 'choppiness',
        symbol,
        signal: 'NEUTRAL',
        strength: 0,
        meta: {
          LONG: 0,
          SHORT: 0,
          chop: null,
          candlesUsed: trs.length,
          period,
          interpretation: 'Invalid calculation parameters',
        },
      };
    }

    const logSumTR = Math.log10(sumTR);
    const logHighLowRange = Math.log10(highLowRange);
    const logPeriod = Math.log10(period);

    const chop = (100 * (logSumTR - logHighLowRange)) / logPeriod;

    // --- інвертуємо логіку: чим більше CHOP (flat market), тим менше score ---
    // CHOP 0-30 = strong trend (good for trading) = high score
    // CHOP 30-60 = mixed market = medium score
    // CHOP 60-100 = choppy/flat market (bad for trading) = low score
    let chopInverted = 0;
    if (chop <= 30) {
      // Strong trend - максимальний score
      chopInverted = 100;
    } else if (chop <= 60) {
      // Mixed market - лінійне зменшення від 100 до 50
      chopInverted = 100 - ((chop - 30) / 30) * 50;
    } else {
      // Choppy market - лінійне зменшення від 50 до 0
      chopInverted = Math.max(0, 50 - ((chop - 60) / 40) * 50);
    }

    // --- визначаємо сигнал та силу ---
    let signal = 'NEUTRAL';

    if (chopInverted >= 70) {
      signal = 'ACTIVE'; // Good for trading (trending market)
    } else if (chopInverted <= 30) {
      signal = 'NONE'; // Bad for trading (choppy market)
    } else {
      signal = 'NEUTRAL'; // Mixed conditions
    }

    return {
      module: 'choppiness',
      symbol,
      signal, // 'ACTIVE' | 'NEUTRAL' | 'NONE'
      strength: Number(chopInverted.toFixed(2)), // 0..100
      meta: {
        LONG: Number(chopInverted.toFixed(2)), // CHOP не має напрямку, однаковий для LONG/SHORT
        SHORT: Number(chopInverted.toFixed(2)),
        chop: Number(chop.toFixed(2)), // оригінальне значення CHOP
        candlesUsed: trs.length,
        period,
        interpretation:
          chop <= 30
            ? 'Strong Trend'
            : chop <= 60
              ? 'Mixed Market'
              : 'Choppy Market',
      },
    };
  } catch (error) {
    logger.error(
      `❌ Error in choppiness analysis for ${symbol}:`,
      error.message,
    );
    return null;
  }
}
