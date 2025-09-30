import { EMA, RSI } from '../../utils/getEMAAndRSI.js';

// Wilder RSI full-series (returns array aligned to candles; nulls before seed complete)
function computeRSISeries(values = [], period = 14) {
  const n = Array.isArray(values) ? values.length : 0;
  const out = new Array(n).fill(null);
  if (n < period + 1) return out;

  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = values[i] - values[i - 1];
    if (diff >= 0) gain += diff;
    else loss += -diff;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  let rs = avgLoss === 0 ? Infinity : avgGain / avgLoss;
  out[period] = 100 - 100 / (1 + rs);

  for (let i = period + 1; i < n; i++) {
    const diff = values[i] - values[i - 1];
    const g = diff > 0 ? diff : 0;
    const l = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + g) / period;
    avgLoss = (avgLoss * (period - 1) + l) / period;
    rs = avgLoss === 0 ? Infinity : avgGain / avgLoss;
    out[i] = 100 - 100 / (1 + rs);
  }

  return out.map((v) => (v == null ? null : parseFloat(v.toFixed(2))));
}

export async function analyzeCandles(symbol = 'ETHUSDT', candles = []) {
  if (!candles || candles.length < 21) {
    console.log(
      `⏳ Only ${candles?.length || 0} candles for ${symbol}, need ≥21...`,
    );
    return null;
  }

  const closes = candles.map((c) => c.close);
  const volumes = candles.map((c) => Number(c.volume ?? 0));

  // Full RSI-by-candle series and last RSI
  const rsiSeries = computeRSISeries(closes, 14);
  // Keep backward compatibility: use series last if available, otherwise fallback to single-value util
  let rsi = rsiSeries[rsiSeries.length - 1];
  if (rsi == null || Number.isNaN(rsi)) {
    rsi = RSI(closes, 14);
  }

  const emaFast = EMA(closes, 9, { seed: 'sma' });
  const emaSlow = EMA(closes, 21, { seed: 'sma' });
  const emaGapPct = ((emaFast - emaSlow) / emaSlow) * 100;

  let longScore = 50;
  let shortScore = 50;

  if (emaGapPct > 0) {
    longScore += Math.min(30, Math.abs(emaGapPct) * 5);
    shortScore -= Math.min(30, Math.abs(emaGapPct) * 5);
  } else {
    shortScore += Math.min(30, Math.abs(emaGapPct) * 5);
    longScore -= Math.min(30, Math.abs(emaGapPct) * 5);
  }

  if (rsi < 30) {
    longScore += 20;
    shortScore -= 20;
  } else if (rsi > 70) {
    shortScore += 20;
    longScore -= 20;
  }

  longScore = Math.max(0, Math.min(100, longScore));
  shortScore = Math.max(0, Math.min(100, shortScore));

  let signal = 'NEUTRAL';
  if (longScore > shortScore) signal = 'LONG';
  else if (shortScore > longScore) signal = 'SHORT';

  return {
    module: 'trend',
    symbol,
    signal,
    strength: Math.max(longScore, shortScore),
    meta: {
      LONG: longScore,
      SHORT: shortScore,
      emaFast: parseFloat(emaFast.toFixed(2)),
      emaSlow: parseFloat(emaSlow.toFixed(2)),
      emaGapPct: parseFloat(emaGapPct.toFixed(2)),
      // RSI (single value for backward compatibility)
      rsi: parseFloat(rsi.toFixed(2)),
      // RSI by candles (aligned to input candles; null while seed not complete)
      rsiSeries,
      lastRSI: rsi != null ? parseFloat(rsi.toFixed(2)) : null,
      // Volume info
      volumes,
      lastVolume: volumes[volumes.length - 1] ?? null,
    },
  };
}
