// src/analize-modules/custom/custom-module.js
// RSI + Volume + Trend (MA7/MA25) scoring module (standardized, hardcoded params)
// - No fetching inside: candles are provided by the analyzer
// - No config arguments: everything is hardcoded below
// - Returns: { module, symbol, signal, strength, meta: { LONG, SHORT, ... } }

// ----- hardcoded params -----
const RSI_PERIOD = 50;
const RSI_WARMUP = 100;
const VOL_LOOKBACK = 10;
const MA_SHORT = 7;
const MA_LONG = 25;

// ---------- math helpers ----------
function sma(values, period) {
  if (!Array.isArray(values) || values.length < period) return null;
  let sum = 0;
  for (let i = values.length - period; i < values.length; i++)
    sum += Number(values[i]) || 0;
  return sum / period;
}

// Wilder RSI with warmup
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

function mapScore(checksCount) {
  if (checksCount <= 0) return 0;
  if (checksCount === 1) return 33;
  if (checksCount === 2) return 66;
  return 100;
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
      meta: {
        LONG: 0,
        SHORT: 0,
        candlesUsed: Array.isArray(candles) ? candles.length : 0,
        needBars,
      },
    };
  }

  const closes = candles.map((c) => Number(c.close) || 0);
  const vols = candles.map((c) => Number(c.volume) || 0);

  const price = closes[closes.length - 1];
  const ma7 = sma(closes, MA_SHORT);
  const ma25 = sma(closes, MA_LONG);

  const lastVol = vols[vols.length - 1];
  const avgVol = avg(vols.slice(-VOL_LOOKBACK));

  const rsi = rsiWilder(closes, RSI_PERIOD, RSI_WARMUP);

  const volAboveAvg =
    avgVol != null && lastVol != null ? lastVol > avgVol : false;
  const longTrendOk =
    price != null && ma7 != null && ma25 != null
      ? price > ma7 && ma7 > ma25
      : false;
  const shortTrendOk =
    price != null && ma7 != null && ma25 != null
      ? ma25 > ma7 && ma7 > price
      : false;

  // Safety: suppress when RSI is extreme
  if (rsi != null && (rsi > 70 || rsi < 30)) {
    return {
      module: 'rsiVolTrend',
      symbol,
      signal: 'NEUTRAL',
      strength: 0,
      meta: {
        LONG: 0,
        SHORT: 0,
        candlesUsed: candles.length,
        rsi: rsi != null ? Number(rsi.toFixed(2)) : null,
        price: Number.isFinite(price) ? Number(price) : null,
        ma7: Number.isFinite(ma7) ? Number(ma7) : null,
        ma25: Number.isFinite(ma25) ? Number(ma25) : null,
        volume: Number.isFinite(lastVol) ? Number(lastVol) : null,
        avgVol: Number.isFinite(avgVol) ? Number(avgVol) : null,
        rsiPeriod: RSI_PERIOD,
        rsiWarmup: RSI_WARMUP,
        volLookback: VOL_LOOKBACK,
        maShort: MA_SHORT,
        maLong: MA_LONG,
      },
    };
  }

  // LONG checks
  const longVol = volAboveAvg;
  const longRsi = rsi != null ? rsi > 55 : false;
  const longChecks = [longTrendOk, longVol, longRsi].filter(Boolean).length;
  const LONG = mapScore(longChecks);

  // SHORT checks
  const shortVol = volAboveAvg;
  const shortRsi = rsi != null ? rsi < 45 : false;
  const shortChecks = [shortTrendOk, shortVol, shortRsi].filter(Boolean).length;
  const SHORT = mapScore(shortChecks);

  // Decide signal/strength with small dead-zone to avoid flip-flop
  const deadPts = 5;
  let signal = 'NEUTRAL';
  if (Math.abs(LONG - SHORT) > deadPts) {
    signal = LONG > SHORT ? 'LONG' : 'SHORT';
  }
  const strength = Math.max(LONG, SHORT);

  return {
    module: 'rsiVolTrend',
    symbol,
    signal,
    strength,
    meta: {
      LONG,
      SHORT,
      candlesUsed: candles.length,
      rsi: rsi != null ? Number(rsi.toFixed(2)) : null,
      price: Number.isFinite(price) ? Number(price) : null,
      ma7: Number.isFinite(ma7) ? Number(ma7) : null,
      ma25: Number.isFinite(ma25) ? Number(ma25) : null,
      volume: Number.isFinite(lastVol) ? Number(lastVol) : null,
      avgVol: Number.isFinite(avgVol) ? Number(avgVol) : null,
      rsiPeriod: RSI_PERIOD,
      rsiWarmup: RSI_WARMUP,
      volLookback: VOL_LOOKBACK,
      maShort: MA_SHORT,
      maLong: MA_LONG,
    },
  };
}

export default analyzeRsiVolumeTrend;
