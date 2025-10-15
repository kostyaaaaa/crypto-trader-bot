import type { ITrendRegimeMix, ITrendRegimeModule } from 'crypto-trader-db';
import type { Candle } from '../../types/index';

export interface TrendRegimeOptionsObj {
  period?: number;
  adxSignalMin?: number;
  adxMaxForScale?: number;
  mix?: ITrendRegimeMix;
}

export type TrendRegimeOptions = number | TrendRegimeOptionsObj;

export async function analyzeTrendRegime(
  symbol: string,
  candles: Candle[],
  options: TrendRegimeOptions = 14,
): Promise<ITrendRegimeModule | null> {
  const period =
    typeof options === 'number' ? options : (options?.period ?? 14);
  const adxSignalMin =
    typeof options === 'number' ? 7 : (options?.adxSignalMin ?? 7);
  const adxMaxForScale =
    typeof options === 'number' ? 35 : (options?.adxMaxForScale ?? 35);
  const mixAdx = typeof options === 'number' ? 0.5 : (options?.mix?.adx ?? 0.5);
  const mixGap = typeof options === 'number' ? 0.5 : (options?.mix?.gap ?? 0.5);

  if (!Array.isArray(candles) || candles.length < period + 2) {
    return null;
  }

  const clamp = (v: number, a: number, b: number) =>
    Math.min(b, Math.max(a, v));
  const round3 = (v: number) =>
    Number((Math.round((v + Number.EPSILON) * 1000) / 1000).toFixed(3));

  const sliced = candles.slice(-(period + 2));

  const highs = sliced.map((c) => c.high);
  const lows = sliced.map((c) => c.low);
  const closes = sliced.map((c) => c.close);

  const tr: number[] = [];
  const plusDM: number[] = [];
  const minusDM: number[] = [];

  for (let i = 1; i < sliced.length; i++) {
    const upMove = highs[i] - highs[i - 1];
    const downMove = lows[i - 1] - lows[i];

    plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);

    const range1 = highs[i] - lows[i];
    const range2 = Math.abs(highs[i] - closes[i - 1]);
    const range3 = Math.abs(lows[i] - closes[i - 1]);
    tr.push(Math.max(range1, range2, range3));
  }

  const smooth = (arr: number[], p: number): number[] => {
    const result: number[] = [];
    let sum = arr.slice(0, p).reduce((a, b) => a + b, 0);
    result[p - 1] = sum;
    for (let i = p; i < arr.length; i++) {
      sum = result[i - 1] - result[i - 1] / p + arr[i];
      result[i] = sum;
    }
    return result;
  };

  const trSmooth = smooth(tr, period);
  const plusSmooth = smooth(plusDM, period);
  const minusSmooth = smooth(minusDM, period);

  const plusDI = plusSmooth.map((p, i) => (p / trSmooth[i]) * 100);
  const minusDI = minusSmooth.map((m, i) => (m / trSmooth[i]) * 100);

  const dx = plusDI.map((p, i) => {
    const m = minusDI[i];
    return (Math.abs(p - m) / Math.max(p + m, 1e-9)) * 100;
  });

  const adxArr = smooth(dx, period).map((v) => v / period);

  const lastPlus = plusDI.at(-1) ?? 0;
  const lastMinus = minusDI.at(-1) ?? 0;
  const lastAdx = adxArr.at(-1) ?? 0;

  let dir: string = 'NEUTRAL';
  if (lastPlus > lastMinus) dir = 'LONG';
  else if (lastMinus > lastPlus) dir = 'SHORT';

  // Scale ADX to 0..100 and apply a dead-zone to the directional gap before mixing
  const adxScaled = clamp((lastAdx / adxMaxForScale) * 100, 0, 100);
  const dirGapPctRaw = clamp(
    (Math.abs(lastPlus - lastMinus) / Math.max(lastPlus + lastMinus, 1e-9)) *
      100,
    0,
    100,
  );
  // small dead-zone helps ignore micro-imbalance in +DI/-DI when market is choppy
  const DIRGAP_DEAD = 5;
  const dirGapEff =
    dirGapPctRaw <= DIRGAP_DEAD
      ? 0
      : ((dirGapPctRaw - DIRGAP_DEAD) / (100 - DIRGAP_DEAD)) * 100;

  // Normalize mix weights so they always sum to 1
  const mixSum = Math.max(mixAdx + mixGap, 1e-9);
  const wAdx = mixAdx / mixSum;
  const wGap = mixGap / mixSum;

  // Raw strength 0..100
  const strengthRaw = clamp(wAdx * adxScaled + wGap * dirGapEff, 0, 100);

  // Soft gate by ADX vs threshold:
  // x in [0..1]; add floor so low-ADX не зводить сигнал в нуль
  const x = clamp(lastAdx / Math.max(adxSignalMin, 1e-9), 0, 1);
  const GATE_FLOOR = 0.25; // мінімум 25% сили навіть нижче порогу
  const GATE_POW = 0.7; // м'якість кривої (0.5..1.0)
  const gate = GATE_FLOOR + (1 - GATE_FLOOR) * Math.pow(x, GATE_POW);

  const eff = round3(strengthRaw * gate); // 0..100

  // Розподіляємо ефективну силу між LONG/SHORT пропорційно +DI/-DI
  const sumDI = Math.max(lastPlus + lastMinus, 1e-9);
  const shareLong = clamp(lastPlus / sumDI, 0, 1);
  const shareShort = clamp(lastMinus / sumDI, 0, 1);

  const LONGv = round3(clamp(eff * shareLong, 0, 100));
  const SHORTv = round3(clamp(eff * shareShort, 0, 100));

  const NEUTRAL_BAND = 5; // points of effective strength to call it neutral
  let signal: 'LONG' | 'SHORT' | 'NEUTRAL' = 'NEUTRAL';
  if (eff >= NEUTRAL_BAND) {
    signal =
      lastPlus > lastMinus
        ? 'LONG'
        : lastMinus > lastPlus
          ? 'SHORT'
          : 'NEUTRAL';
  }

  return {
    type: 'scoring',
    module: 'trendRegime',
    symbol,
    meta: {
      LONG: LONGv,
      SHORT: SHORTv,
      ADX: Number(lastAdx.toFixed(2)),
      ADX_scaled: round3(adxScaled),
      dirGapPct: round3(dirGapPctRaw), // keep raw for transparency in meta
      plusDI: Number(lastPlus.toFixed(2)),
      minusDI: Number(lastMinus.toFixed(2)),
      period,
      adxSignalMin,
      adxMaxForScale,
      mix: { adx: mixAdx, gap: mixGap },
      candlesUsed: sliced.length,
    },
  };
}

export default analyzeTrendRegime;
