import type {
  IVolatilityModule,
  IVolatilityRegime,
  IVolatilityThresholds,
} from 'crypto-trader-db';
import type { Candle } from '../../types/index';
export async function analyzeVolatility(
  symbol: string = 'ETHUSDT',
  candles: Candle[] = [],
  window: number = 14,
  volatilityFilter: IVolatilityThresholds = {
    deadBelow: 0.2,
    extremeAbove: 2.5,
  },
): Promise<IVolatilityModule | null> {
  if (!Array.isArray(candles) || candles.length < window + 1) {
    return null;
  }

  // останні N свічок
  const recent = candles.slice(-window);

  // TR = max(high-low, |high-prevClose|, |low-prevClose|)
  const trs: number[] = [];
  for (let i = 1; i < recent.length; i++) {
    const curr = recent[i];
    const prev = recent[i - 1];

    const hl = curr.high - curr.low;
    const hc = Math.abs(curr.high - prev.close);
    const lc = Math.abs(curr.low - prev.close);

    trs.push(Math.max(hl, hc, lc));
  }

  const atr = trs.reduce((s, v) => s + v, 0) / trs.length;
  const lastClose = recent[recent.length - 1].close;
  const atrPct = (atr / lastClose) * 100;

  let regime: IVolatilityRegime = 'NORMAL';
  let signal: string = 'ACTIVE';
  let strength = 0;

  if (atrPct < volatilityFilter.deadBelow) {
    regime = 'DEAD';
    signal = 'NONE';
    strength = 0;
  } else if (atrPct > volatilityFilter.extremeAbove) {
    regime = 'EXTREME';
    signal = 'NONE';
    strength = 100; // дуже висока активність, але не торгуємо
  } else {
    regime = 'NORMAL';
    signal = 'ACTIVE';
    strength = Math.min(100, atrPct * 50); // масштабуємо ATR%
  }

  return {
    module: 'volatility',
    symbol,
    signal,
    strength,
    meta: {
      LONG: strength,
      SHORT: strength,
      regime,
      candlesUsed: trs.length,
      atrAbs: Number(atr.toFixed(5)),
      atrPct: Number(atrPct.toFixed(2)),
      window,
      thresholds: volatilityFilter,
    },
  };
}
