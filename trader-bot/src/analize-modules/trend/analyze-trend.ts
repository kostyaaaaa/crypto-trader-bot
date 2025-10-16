import type { ITrendModule } from 'crypto-trader-db';
import type { Candle } from '../../types/candles';
import { computeRSISeries } from '../../utils/computeRSISeries';
import { EMA, RSI } from '../../utils/getEMAAndRSI';

const toFixedOrNull = (v: number | null | undefined, d = 2): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? Number(v.toFixed(d)) : null;

export async function analyzeTrend(
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

  // === Smooth RSI adjustment (no inversion, trend-aware) ===
  {
    const r = rsiUsed;
    let adjLong = 0;
    let adjShort = 0;

    // Upper side (RSI > 50)
    if (r >= 55 && r <= 65) {
      const k = (r - 55) / 10; // 0..1
      if (emaGapPct > 0) adjLong += 10 * k; // gentle boost with trend
      if (emaGapPct < 0) adjShort += 10 * k;
    } else if (r > 65 && r <= 75) {
      const k = (r - 65) / 10; // 0..1
      if (emaGapPct > 0) adjLong += 10 * (1 - k); // fade boost
      if (emaGapPct < 0) adjShort += 10 * (1 - k);
    } else if (r > 75) {
      const k = Math.min(1, (r - 75) / 10); // 0..1
      if (emaGapPct > 0) adjLong -= 10 * k; // overbought: penalize trend side
      if (emaGapPct < 0) adjShort -= 10 * k;
    }

    // Lower side (RSI < 50)
    if (r <= 45 && r >= 35) {
      const k = (45 - r) / 10; // 0..1
      if (emaGapPct < 0) adjShort += 10 * k; // gentle boost with trend
      if (emaGapPct > 0) adjLong += 10 * k;
    } else if (r < 35 && r >= 25) {
      const k = (35 - r) / 10; // 0..1
      if (emaGapPct < 0) adjShort += 10 * (1 - k); // fade boost
      if (emaGapPct > 0) adjLong += 10 * (1 - k);
    } else if (r < 25) {
      const k = Math.min(1, (25 - r) / 10); // 0..1
      if (emaGapPct < 0) adjShort -= 10 * k; // oversold: penalize trend side
      if (emaGapPct > 0) adjLong -= 10 * k;
    }

    longScore += adjLong;
    shortScore += adjShort;
  }

  longScore = Math.max(0, Math.min(100, longScore));
  shortScore = Math.max(0, Math.min(100, shortScore));

  let signal: string = 'NEUTRAL';
  if (longScore > shortScore) signal = 'LONG';
  else if (shortScore > longScore) signal = 'SHORT';

  return {
    type: 'scoring',
    module: 'trend',
    symbol,
    meta: {
      LONG: longScore,
      SHORT: shortScore,
      emaFast: toFixedOrNull(emaFast, 2),
      emaSlow: toFixedOrNull(emaSlow, 2),
      emaGapPct: Number(emaGapPct.toFixed(2)),
      rsi: Number(rsiUsed.toFixed(2)),
      rsiRaw: toFixedOrNull(typeof rsiRaw === 'number' ? rsiRaw : null, 2),
      lastRSI: toFixedOrNull(typeof rsiRaw === 'number' ? rsiRaw : null, 2),
      lastVolume: volumes[volumes.length - 1] ?? null,
    },
  };
}
