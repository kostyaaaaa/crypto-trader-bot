// modules/trendRegime/analyze-trend-regime.js
// --- Аналіз Trend Regime через ADX / DI ---
// Використовує свічки (high, low, close)
// Нормалізація сили сигналу у стобальній шкалі 0..100.
// Параметри:
//   options: number | {
//     period?: number,          // default 14
//     adxSignalMin?: number,    // default 7 — поріг для НЕ NEUTRAL сигналу
//     adxMaxForScale?: number,  // default 35 — ADX, якому відповідає 100 балів
//     mix?: { adx?: number, gap?: number } // default 0.5 / 0.5 — ваги змішування
//   }
//   Примітка: увімкнено "м'який gate": коли ADX нижче порога, signal=NEUTRAL,
//   але LONG/SHORT отримують частку сили, пропорційну lastAdx/adxSignalMin.

export async function analyzeTrendRegime(symbol, candles, options = 14) {
  // options: number => period, or object => { period, adxSignalMin, adxMaxForScale, mix }
  const period =
    typeof options === 'number' ? options : (options?.period ?? 14);
  const adxSignalMin =
    typeof options === 'number' ? 7 : (options?.adxSignalMin ?? 7);
  const adxMaxForScale =
    typeof options === 'number' ? 35 : (options?.adxMaxForScale ?? 35); // 35 ADX ≈ дуже сильний тренд для шкали
  const mixAdx = typeof options === 'number' ? 0.5 : (options?.mix?.adx ?? 0.5);
  const mixGap = typeof options === 'number' ? 0.5 : (options?.mix?.gap ?? 0.5);

  if (!Array.isArray(candles) || candles.length < period + 2) {
    return null;
  }

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const round3 = (v) =>
    Number((Math.round((v + Number.EPSILON) * 1000) / 1000).toFixed(3));

  // беремо тільки останні N+1 свічок
  const sliced = candles.slice(-(period + 2));

  const highs = sliced.map((c) => c.high);
  const lows = sliced.map((c) => c.low);
  const closes = sliced.map((c) => c.close);

  const tr = [];
  const plusDM = [];
  const minusDM = [];

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

  // Wilder’s smoothing
  const smooth = (arr, p) => {
    const result = [];
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

  const lastPlus = plusDI.at(-1);
  const lastMinus = minusDI.at(-1);
  const lastAdx = adxArr.at(-1);

  // --- напрямок за DI ---
  let dir = 'NEUTRAL';
  if (lastPlus > lastMinus) dir = 'LONG';
  else if (lastMinus > lastPlus) dir = 'SHORT';

  // --- нормалізація сили ---
  // 1) ADX масштабуємо до 0..100, де adxMaxForScale => 100
  const adxScaled = clamp((lastAdx / adxMaxForScale) * 100, 0, 100);
  // 2) DI-gap як додаткова впевненість (0..100)
  const dirGapPct = clamp(
    (Math.abs(lastPlus - lastMinus) / Math.max(lastPlus + lastMinus, 1e-9)) *
      100,
    0,
    100,
  );
  // 3) Змішуємо за вагами — raw сила (ще без урахування порогу ADX)
  const strengthRawUnclamped = mixAdx * adxScaled + mixGap * dirGapPct; // 0..100
  const strengthRaw = clamp(strengthRawUnclamped, 0, 100);

  // --- фінальний сигнал (м'який gate) ---
  // Нормуємо так само, як інші модулі: базово 50/50, відхилення ±(eff/2).
  // Якщо ADX нижче порогу — signal=NEUTRAL, але відхилення зменшуємо gate-фактором.
  const gate = clamp(lastAdx / Math.max(adxSignalMin, 1e-9), 0, 1);
  const eff = round3(strengthRaw * gate); // 0..100 — ефективна сила після gate

  let signal = 'NEUTRAL';
  let LONGv = round3(50);
  let SHORTv = round3(50);

  if (dir === 'LONG') {
    LONGv = round3(clamp(50 + eff / 2, 0, 100));
    SHORTv = round3(clamp(50 - eff / 2, 0, 100));
    if (lastAdx >= adxSignalMin) signal = 'LONG';
  } else if (dir === 'SHORT') {
    SHORTv = round3(clamp(50 + eff / 2, 0, 100));
    LONGv = round3(clamp(50 - eff / 2, 0, 100));
    if (lastAdx >= adxSignalMin) signal = 'SHORT';
  }

  // Сила модуля = сила переважної сторони (для консистентності)
  const strengthOut = Math.max(LONGv, SHORTv);

  return {
    module: 'trendRegime',
    symbol,
    signal, // LONG / SHORT / NEUTRAL
    strength: strengthOut, // 0..100
    meta: {
      LONG: LONGv,
      SHORT: SHORTv,
      ADX: Number(lastAdx?.toFixed(2)),
      ADX_scaled: round3(adxScaled),
      dirGapPct: round3(dirGapPct),
      plusDI: Number(lastPlus?.toFixed(2)),
      minusDI: Number(lastMinus?.toFixed(2)),
      period,
      adxSignalMin,
      adxMaxForScale,
      mix: { adx: mixAdx, gap: mixGap },
      candlesUsed: sliced.length,
    },
  };
}
