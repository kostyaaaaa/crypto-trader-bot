import axios from 'axios';
import type { IChoppinessModule } from 'crypto-trader-db';
import type { BinanceKline } from '../../types/index';
import logger from '../../utils/db-logger';
// ─── Допоміжні типи ───────────────────────────────────────────────────────────
export type AnalysisSignal = 'ACTIVE' | 'NEUTRAL' | 'NONE';

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

// ─── Основна функція ──────────────────────────────────────────────────────────
export async function analyzeChoppiness(
  symbol: string = 'ETHUSDT',
  period: number = 10, // використовуємо 10 свічок як запитано
): Promise<IChoppinessModule | null> {
  try {
    const safePeriod = Math.max(2, Math.floor(Number(period) || 10));

    // --- отримуємо 1-хвилинні свічки з Binance ---
    const { data } = await axios.get<BinanceKline[]>(
      'https://fapi.binance.com/fapi/v1/klines',
      {
        params: {
          symbol,
          interval: '1m', // завжди 1-хвилинні свічки
          limit: safePeriod + 1, // потрібно +1 для TR розрахунку
        },
      },
    );

    if (!Array.isArray(data) || data.length < safePeriod + 1) {
      logger.warn(
        `⚠️ Insufficient 1m candle data for ${symbol} choppiness analysis`,
      );
      return null;
    }

    // --- конвертуємо дані Binance в наш формат (ISO time + числа) ---
    const candles = data.map((k) => ({
      time: new Date(k[0]).toISOString(),
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5]),
    }));

    // --- беремо останні N+1 свічок (потрібно +1 для TR розрахунку) ---
    const recent = candles.slice(-(safePeriod + 1));

    // --- розрахунок True Range (TR) для кожної свічки ---
    const trs: number[] = [];
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

    // --- підсумовуємо TR ---
    const sumTR = trs.reduce((sum, tr) => sum + tr, 0);

    // Перевірка граничних випадків
    if (sumTR <= 0 || highLowRange <= 0 || safePeriod <= 0) {
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
          period: safePeriod,
          interpretation: 'Invalid calculation parameters',
        },
      };
    }

    // --- розрахунок CHOP за формулою ---
    const logSumTR = Math.log10(sumTR);
    const logHighLowRange = Math.log10(highLowRange);
    const logPeriod = Math.log10(safePeriod);

    const chop = (100 * (logSumTR - logHighLowRange)) / logPeriod; // 0..100 (в теорії)

    // --- інвертуємо логіку: чим більше CHOP (flat market), тим менше score ---
    // CHOP 0-30 = strong trend (good for trading) = high score
    // CHOP 30-60 = mixed market = medium score
    // CHOP 60-100 = choppy/flat market (bad for trading) = low score
    let chopInverted = 0;
    if (chop <= 30) {
      chopInverted = 100; // Strong trend - максимальний score
    } else if (chop <= 60) {
      chopInverted = 100 - ((chop - 30) / 30) * 50; // Mixed market - лінійне зменшення 100 → 50
    } else {
      chopInverted = Math.max(0, 50 - ((chop - 60) / 40) * 50); // Choppy market - 50 → 0
    }

    // --- визначаємо сигнал та силу ---
    let signal: AnalysisSignal = 'NEUTRAL';
    if (chopInverted >= 70) signal = 'ACTIVE';
    else if (chopInverted <= 30) signal = 'NONE';

    const strength = Number(chopInverted.toFixed(2));

    const result: IChoppinessModule = {
      module: 'choppiness',
      symbol,
      signal, // 'ACTIVE' | 'NEUTRAL' | 'NONE'
      strength, // 0..100
      meta: {
        LONG: strength, // CHOP не має напрямку, однаковий для LONG/SHORT
        SHORT: strength,
        chop: Number(chop.toFixed(2)), // оригінальне значення CHOP
        candlesUsed: trs.length,
        period: safePeriod,
        interpretation:
          chop <= 30
            ? 'Strong Trend'
            : chop <= 60
              ? 'Mixed Market'
              : 'Choppy Market',
      },
    };

    return result;
  } catch (error: unknown) {
    logger.error(
      `❌ Error in choppiness analysis for ${symbol}:`,
      errMsg(error),
    );
    return null;
  }
}
