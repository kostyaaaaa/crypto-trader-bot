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

  const rsiRaw = rsiSeries.at(-1) ?? RSI(closes, rsiPeriod);
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

  let longScore = 0;
  let shortScore = 0;

  // ==== Tunables (make zeros happen рідше без шуму) ====
  const EMA_GAP_DEAD = 0.03; // percent dead-zone for EMA gap (було 0.1)
  const EMA_GAP_SCALE = 20; // points per 1% effective gap, cap 60
  const RSI_DEAD = 3; // dead-zone навколо 50 (було 30..70)
  const RSI_SCALE = 2; // points per RSI point beyond dead-zone, cap 40

  const gapAbs = Math.abs(emaGapPct);
  const gapEff = gapAbs <= EMA_GAP_DEAD ? 0 : gapAbs;
  if (emaGapPct > 0) {
    longScore += Math.min(60, gapEff * EMA_GAP_SCALE);
  } else if (emaGapPct < 0) {
    shortScore += Math.min(60, gapEff * EMA_GAP_SCALE);
  }

  const rsiDist = Math.max(0, Math.abs(rsiUsed - 50) - RSI_DEAD);
  const rsiPoints = Math.min(40, rsiDist * RSI_SCALE);
  if (rsiUsed >= 50) {
    longScore += rsiPoints;
  } else {
    shortScore += rsiPoints;
  }

  longScore = Math.max(0, Math.min(100, longScore));
  shortScore = Math.max(0, Math.min(100, shortScore));

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
