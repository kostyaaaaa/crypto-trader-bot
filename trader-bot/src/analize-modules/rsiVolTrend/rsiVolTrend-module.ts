import { type IRsiVolTrendModule } from 'crypto-trader-db';
import type { Candle } from '../../types/index';
import { computeRSISeries } from '../../utils/computeRSISeries';
import { RSI } from '../../utils/getEMAAndRSI';

const RSI_PERIOD = 14;
const RSI_WARMUP = 60;
const VOL_LOOKBACK = 10;
const MA_SHORT = 7;
const MA_LONG = 25;
const CANDLE_DURATION_MS_FALLBACK = 15 * 60 * 1000;

// ---------- math helpers ----------
function sma(values: number[], period: number): number | null {
  if (!Array.isArray(values) || values.length < period) return null;
  let sum = 0;
  for (let i = values.length - period; i < values.length; i++) {
    sum += Number(values[i]) || 0;
  }
  return sum / period;
}

function avg(values: number[]): number | null {
  if (!Array.isArray(values) || values.length === 0) return null;
  let sum = 0;
  for (const v of values) sum += Number(v) || 0;
  return sum / values.length;
}

function inferCandleDurationMs(
  candles: Candle[],
  fallback: number = CANDLE_DURATION_MS_FALLBACK,
): number {
  try {
    if (Array.isArray(candles) && candles.length >= 2) {
      const t1 = Date.parse(candles[candles.length - 1].time);
      const t0 = Date.parse(candles[candles.length - 2].time);
      const diff = t1 - t0;
      if (Number.isFinite(diff) && diff > 0) return diff;
    }
  } catch {}
  return fallback;
}

// ---------- демпфер для силы при низком объёме ----------
function applyVolumeDamping(score: number, volRatio: number): number {
  if (!Number.isFinite(score) || !Number.isFinite(volRatio)) return 0;

  if (volRatio <= 0.7) return score * (volRatio / 0.7); // линейно от 0 до 0.7
  return score; // выше 0.7 — без изменений
}

// ---------- main module ----------
export async function analyzeRsiVolumeTrend(
  symbol: string,
  candles: Candle[] | null = null,
): Promise<IRsiVolTrendModule> {
  const needBars = Math.max(
    RSI_WARMUP + RSI_PERIOD + 5,
    MA_LONG + VOL_LOOKBACK + 5,
  );

  if (!Array.isArray(candles) || candles.length < needBars) {
    return {
      module: 'rsiVolTrend',
      symbol,
      signal: 'NEUTRAL',
      strength: 0,
      meta: {
        LONG: 0,
        SHORT: 0,
        candlesUsed: candles?.length ?? 0,
        needBars,
      },
    };
  }

  const closes = candles.map((c) => Number(c.close) || 0);
  const vols = candles.map((c) => Number(c.volume) || 0);
  const price = closes.at(-1) as number;

  const ma7 = sma(closes, MA_SHORT);
  const ma25 = sma(closes, MA_LONG);
  const prevMa7 = sma(closes.slice(0, -1), MA_SHORT);
  const maSlope = ma7 && prevMa7 ? ma7 - prevMa7 : 0;

  const lastCandle = candles.at(-1) as Candle;
  const openTimeMs = Date.parse(lastCandle.time) || 0;
  const durationMs = inferCandleDurationMs(
    candles,
    CANDLE_DURATION_MS_FALLBACK,
  );
  const elapsedMs = Math.max(0, Date.now() - openTimeMs);
  let progress = durationMs > 0 ? elapsedMs / durationMs : 1;
  progress = Math.max(0.1, Math.min(1, progress));

  // ---------- volume logic ----------
  const lastVol = (vols.at(-1) || 0) / progress;
  const avgVol = avg(vols.slice(-VOL_LOOKBACK - 1, -1));
  const volRatio = avgVol ? lastVol / avgVol : 0;

  if (!avgVol || !lastVol) {
    return {
      module: 'rsiVolTrend',
      symbol,
      signal: 'NEUTRAL',
      strength: 0,
      meta: {
        LONG: 0,
        SHORT: 0,
        candlesUsed: candles.length,
        reason: 'LowVolume',
        volRatio: Number(volRatio.toFixed(2)),
        progress: Number((progress * 100).toFixed(1)) + '%',
      },
    };
  }

  // ---------- RSI logic ----------
  const rsiSeries = computeRSISeries(
    closes.slice(-RSI_WARMUP - RSI_PERIOD),
    RSI_PERIOD,
  );
  const rsiRaw = rsiSeries.at(-1) ?? RSI(closes, RSI_PERIOD);
  const rsi =
    typeof rsiRaw === 'number' && Number.isFinite(rsiRaw) ? rsiRaw : 50;

  // ---------- scoring ----------
  let volScore = Number.isFinite(volRatio)
    ? Math.min(100, Math.max(0, ((volRatio - 0.7) / 1.3) * 100))
    : 0;

  let trendLong = 0,
    trendShort = 0;
  if (price && ma7 && ma25) {
    trendLong =
      price > ma7 && ma7 >= ma25 * 0.997
        ? Math.min(100, Math.max(0, (maSlope / ma25) * 100 + 50))
        : 0;
    trendShort =
      price < ma7 && ma7 <= ma25 * 1.003
        ? Math.min(100, Math.max(0, (-maSlope / ma25) * 100 + 50))
        : 0;
  }

  // ---------- RSI усиление ----------
  let rsiBoostLong = 0;
  let rsiBoostShort = 0;

  if (rsi > 72)
    rsiBoostShort = Math.min(20, (rsi - 72) * 1.2); // усиливает SHORT
  else if (rsi < 28) rsiBoostLong = Math.min(20, (28 - rsi) * 1.2); // усиливает LONG

  const rsiLongScore = rsi >= 50 ? ((rsi - 50) / 22) * 100 : 0;
  const rsiShortScore = rsi <= 50 ? ((50 - rsi) / 22) * 100 : 0;

  // ---------- итоговые веса ----------
  let LONG =
    volScore * 0.5 + trendLong * 0.3 + rsiLongScore * 0.15 + rsiBoostLong;
  let SHORT =
    volScore * 0.5 + trendShort * 0.3 + rsiShortScore * 0.15 + rsiBoostShort;

  // ---------- демпфирование по объёму ----------
  LONG = applyVolumeDamping(LONG, volRatio);
  SHORT = applyVolumeDamping(SHORT, volRatio);

  const deadZone = volRatio > 1.5 ? 5 : 15;
  let signal: string = 'NEUTRAL';
  if (Math.abs(LONG - SHORT) >= deadZone) {
    signal = LONG > SHORT ? 'LONG' : 'SHORT';
  }

  const strength = Math.max(LONG, SHORT);

  // ---------- output ----------
  return {
    module: 'rsiVolTrend',
    symbol,
    signal,
    strength: Number(strength.toFixed(2)),
    meta: {
      LONG: Number(LONG.toFixed(2)),
      SHORT: Number(SHORT.toFixed(2)),
      candlesUsed: candles.length,
      progress: Number((progress * 100).toFixed(1)) + '%',
      rsi: Number(rsi.toFixed(2)),
      rsiLongScore: Number(rsiLongScore.toFixed(2)),
      rsiShortScore: Number(rsiShortScore.toFixed(2)),
      volRatio: Number(volRatio.toFixed(2)),
      trendLong: Number(trendLong.toFixed(2)),
      trendShort: Number(trendShort.toFixed(2)),
      price: Number(price.toFixed(6)),
      ma7: Number(ma7?.toFixed(6) as any),
      ma25: Number(ma25?.toFixed(6) as any),
      maSlope: Number(maSlope?.toFixed(6) as any),
      volume: Number(lastVol.toFixed(2)),
      avgVol: Number((avgVol ?? 0).toFixed(2)),
      rsiPeriod: RSI_PERIOD,
      rsiWarmup: RSI_WARMUP,
      volLookback: VOL_LOOKBACK,
      maShort: MA_SHORT,
      maLong: MA_LONG,
      deadZone,
      candleOpen: lastCandle.time,
      candleDurationMs: durationMs,
    },
  };
}

export default analyzeRsiVolumeTrend;
