import type { ITrendModule } from 'crypto-trader-db';
import type { Candle } from '../../types/types';
import { EMA, RSI } from '../../utils/getEMAAndRSI';

const toFixedOrNull = (v: number | null | undefined, d = 2): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? Number(v.toFixed(d)) : null;

function computeRSISeries(
  values: number[] = [],
  period = 14,
): (number | null)[] {
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

export async function analyzeCandles(
  symbol: string = 'ETHUSDT',
  candles: Candle[] = [],
): Promise<ITrendModule | null> {
  const rsiPeriod = 14;
  const fast = 9;
  const slow = 21;
  const minNeeded = Math.max(rsiPeriod + 1, slow + 1);

  if (!candles || candles.length < minNeeded) {
    return null;
  }

  const closes = candles.map((c) => c.close);
  const volumes = candles.map((c) => Number(c.volume ?? 0));
  const rsiSeries = computeRSISeries(closes, rsiPeriod);

  // raw RSI may be null while seed isn't complete; fall back to single-value util
  const rsiRaw = rsiSeries.at(-1) ?? RSI(closes, rsiPeriod);
  // neutral fallback (keeps scores stable) if RSI still unavailable
  const rsiUsed: number =
    typeof rsiRaw === 'number' && Number.isFinite(rsiRaw) ? rsiRaw : 50;

  const emaFast = EMA(closes, fast, { seed: 'sma' });
  const emaSlow = EMA(closes, slow, { seed: 'sma' });
  const hasEMAs =
    typeof emaFast === 'number' &&
    typeof emaSlow === 'number' &&
    Number.isFinite(emaFast) &&
    Number.isFinite(emaSlow);

  const emaGapPct = hasEMAs
    ? ((((emaFast as number) - emaSlow) as number) / (emaSlow as number)) * 100
    : 0;
  console.log(emaGapPct, 'emaGapPct');

  let longScore = 50;
  let shortScore = 50;

  const gapAbs = Math.abs(emaGapPct);
  const gapEff = gapAbs < 0.1 ? 0 : gapAbs;
  console.log(gapAbs, 'gapAbs');
  console.log(gapEff, 'gapEff');

  if (emaGapPct > 0) {
    longScore += Math.min(30, gapEff * 5);
    shortScore -= Math.min(30, gapEff * 5);
  } else if (emaGapPct < 0) {
    shortScore += Math.min(30, gapEff * 5);
    longScore -= Math.min(30, gapEff * 5);
  }

  if (rsiUsed < 30) {
    longScore += 20;
    shortScore -= 20;
  } else if (rsiUsed > 70) {
    shortScore += 20;
    longScore -= 20;
  }

  longScore = Math.max(0, Math.min(100, longScore));
  shortScore = Math.max(0, Math.min(100, shortScore));

  let signal: string = 'NEUTRAL';
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
      emaFast: toFixedOrNull(emaFast, 2),
      emaSlow: toFixedOrNull(emaSlow, 2),
      emaGapPct: Number(emaGapPct.toFixed(2)),
      rsi: Number(rsiUsed.toFixed(2)),
      rsiRaw: toFixedOrNull(typeof rsiRaw === 'number' ? rsiRaw : null, 2),
      rsiSeries,
      lastRSI: toFixedOrNull(typeof rsiRaw === 'number' ? rsiRaw : null, 2),
      volumes,
      lastVolume: volumes[volumes.length - 1] ?? null,
    },
  };
}
