// modules/trendRegime/analyze-trend-regime.js
// --- Аналіз Trend Regime через ADX / DI ---
// Використовує тільки свічки (high, low, close)

export async function analyzeTrendRegime(symbol, candles, period = 14) {
  if (!candles || candles.length < period + 2) {
    console.log(`⚠️ Not enough candles for ADX (${symbol})`);
    return null;
  }

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
  const smooth = (arr, period) => {
    const result = [];
    let sum = arr.slice(0, period).reduce((a, b) => a + b, 0);
    result[period - 1] = sum;
    for (let i = period; i < arr.length; i++) {
      sum = result[i - 1] - result[i - 1] / period + arr[i];
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
    return (Math.abs(p - m) / (p + m)) * 100;
  });

  const adxArr = smooth(dx, period).map((v) => v / period);

  const lastPlus = plusDI.at(-1);
  const lastMinus = minusDI.at(-1);
  const lastAdx = adxArr.at(-1);

  // --- сигнал ---
  let signal = 'NEUTRAL';
  if (lastAdx > 20) {
    if (lastPlus > lastMinus) signal = 'LONG';
    else if (lastMinus > lastPlus) signal = 'SHORT';
  }

  // strength = сам ADX, нормалізуємо до 0..100
  const strength = Math.min(100, Math.max(0, lastAdx));

  return {
    module: 'trendRegime',
    symbol,
    signal, // LONG / SHORT / NEUTRAL
    strength, // 0..100 (на основі ADX)
    meta: {
      LONG: signal === 'LONG' ? strength : 0,
      SHORT: signal === 'SHORT' ? strength : 0,
      ADX: Number(lastAdx.toFixed(2)),
      plusDI: Number(lastPlus.toFixed(2)),
      minusDI: Number(lastMinus.toFixed(2)),
      period,
      candlesUsed: sliced.length,
    },
  };
}
