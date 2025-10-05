// src/analize-modules/custom/custom-module.js
// RSI + Volume + Trend (MA7/MA25) scoring module

const RSI_PERIOD = 25;
const RSI_WARMUP = 60;
const VOL_LOOKBACK = 10;
const MA_SHORT = 7;
const MA_LONG = 25;
const CANDLE_DURATION_MS = 15 * 60 * 1000;

// ---------- math helpers ----------
function sma(values, period) {
  if (!Array.isArray(values) || values.length < period) return null;
  let sum = 0;
  for (let i = values.length - period; i < values.length; i++)
    sum += Number(values[i]) || 0;
  return sum / period;
}

function rsiWilder(closes, period = 14, warmup = 100) {
  if (!Array.isArray(closes) || closes.length < period + 2) return null;
  const n = closes.length;
  const take = Math.min(n, period + warmup + 2);
  const arr = closes.slice(n - take);
  let gain = 0,
    loss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = arr[i] - arr[i - 1];
    if (diff >= 0) gain += diff;
    else loss -= diff;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  for (let i = period + 1; i < arr.length; i++) {
    const diff = arr[i] - arr[i - 1];
    const g = diff > 0 ? diff : 0;
    const l = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + g) / period;
    avgLoss = (avgLoss * (period - 1) + l) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function avg(values) {
  if (!Array.isArray(values) || values.length === 0) return null;
  let sum = 0;
  for (const v of values) sum += Number(v) || 0;
  return sum / values.length;
}

// ---------- main ----------
export async function analyzeRsiVolumeTrend(symbol, candles = null) {
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
      meta: { LONG: 0, SHORT: 0, candlesUsed: candles?.length ?? 0, needBars },
    };
  }

  const closes = candles.map((c) => Number(c.close) || 0);
  const vols = candles.map((c) => Number(c.volume) || 0);
  const price = closes.at(-1);
  const ma7 = sma(closes, MA_SHORT);
  const ma25 = sma(closes, MA_LONG);

  // --- Volume handling with progress adjustment ---
  const lastCandle = candles.at(-1);
  const elapsedMs =
    Date.now() -
    (Number(lastCandle.timestamp_open) || Number(lastCandle.time_open) || 0);
  const progress = Math.min(1, Math.max(0.1, elapsedMs / CANDLE_DURATION_MS));

  const lastVol = (vols.at(-1) || 0) / progress;

  const avgVol = avg(vols.slice(-VOL_LOOKBACK - 1, -1));

  const volRatio = avgVol ? lastVol / avgVol : 0;
  const maSlope = ma7 && ma25 ? ma7 - ma25 : 0;
  const volMomentum = lastVol - avgVol;

  const rsi = rsiWilder(closes, RSI_PERIOD, RSI_WARMUP);

  // ----------------- HARD FILTERS -----------------
  if (!avgVol || !lastVol || volRatio < 0.7) {
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

  if (rsi != null && (rsi > 72 || rsi < 28)) {
    return {
      module: 'rsiVolTrend',
      symbol,
      signal: 'NEUTRAL',
      strength: 0,
      meta: {
        LONG: 0,
        SHORT: 0,
        candlesUsed: candles.length,
        reason: 'RSI extreme',
        rsi: Number(rsi.toFixed(2)),
        progress: Number((progress * 100).toFixed(1)) + '%',
      },
    };
  }

  // ----------------- SCORING -----------------
  // Volume (50%)
  let volScore = 0;
  if (Number.isFinite(volRatio)) {
    volScore = Math.min(100, Math.max(0, ((volRatio - 0.7) / 1.3) * 100));
  }

  // Trend (30%)
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

  // RSI (20%)
  let rsiLong = 0,
    rsiShort = 0;
  if (rsi != null) {
    rsiLong = rsi >= 50 ? Math.min(100, ((rsi - 50) / 22) * 100) : 0;
    rsiShort = rsi <= 50 ? Math.min(100, ((50 - rsi) / 22) * 100) : 0;
  }

  // Итоговые баллы с весами Volume 0.5, Trend 0.3, RSI 0.2
  const LONG = volScore * 0.5 + trendLong * 0.3 + rsiLong * 0.2;
  const SHORT = volScore * 0.5 + trendShort * 0.3 + rsiShort * 0.2;

  // Dead zone адаптивная
  const deadZone = volRatio > 1.5 ? 5 : 15;
  let signal = 'NEUTRAL';
  if (Math.abs(LONG - SHORT) >= deadZone) {
    signal = LONG > SHORT ? 'LONG' : 'SHORT';
  }

  const strength = Math.max(LONG, SHORT);

  // ----------------- OUTPUT -----------------
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
      rsi: rsi != null ? Number(rsi.toFixed(2)) : null,
      rsiLongScore: Number(rsiLong.toFixed(2)),
      rsiShortScore: Number(rsiShort.toFixed(2)),
      volRatio: Number(volRatio.toFixed(2)),
      trendLong: Number(trendLong.toFixed(2)),
      trendShort: Number(trendShort.toFixed(2)),
      price: Number(price.toFixed(2)),
      ma7: Number(ma7.toFixed(2)),
      ma25: Number(ma25.toFixed(2)),
      maSlope: Number(maSlope.toFixed(4)),
      volume: Number(lastVol.toFixed(2)),
      avgVol: Number(avgVol.toFixed(2)),
      volMomentum: Number(volMomentum.toFixed(2)),
      rsiPeriod: RSI_PERIOD,
      rsiWarmup: RSI_WARMUP,
      volLookback: VOL_LOOKBACK,
      maShort: MA_SHORT,
      maLong: MA_LONG,
      deadZone,
    },
  };
}

export default analyzeRsiVolumeTrend;
