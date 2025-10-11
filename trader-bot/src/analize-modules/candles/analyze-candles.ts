import type { ITrendModule } from 'crypto-trader-db';
import type { Candle } from '../../types/types';
import { computeRSISeries } from '../../utils/computeRSISeries';
import { EMA, RSI } from '../../utils/getEMAAndRSI';

const toFixedOrNull = (v: number | null | undefined, d = 2): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? Number(v.toFixed(d)) : null;

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

  let longScore = 50;
  let shortScore = 50;

  const gapAbs = Math.abs(emaGapPct);
  const gapEff = gapAbs < 0.1 ? 0 : gapAbs;
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
