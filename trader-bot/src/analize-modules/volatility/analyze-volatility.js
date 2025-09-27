// modules/volatility/analyze-volatility.js
// --- Аналіз волатильності через ATR (Average True Range) ---
// DEAD / NORMAL / EXTREME на основі ATR%
// Використовуємо пороги з конфігу volatilityFilter

export async function analyzeVolatility(
  symbol = 'ETHUSDT',
  candles = [],
  window = 14,
  volatilityFilter = { deadBelow: 0.2, extremeAbove: 2.5 }, // дефолт
) {
  if (!candles || candles.length < window + 1) {
    return null;
  }

  // --- беремо останні N свічок ---
  const recent = candles.slice(-window);

  // True Range (TR) = max(high-low, |high-prevClose|, |low-prevClose|)
  const trs = [];
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

  let signal = 'NEUTRAL';
  let strength = 0;
  let regime = 'NORMAL';

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
    signal, // 'NONE' | 'ACTIVE'
    strength, // 0..100
    meta: {
      LONG: strength,
      SHORT: strength,
      regime, // DEAD / NORMAL / EXTREME
      candlesUsed: trs.length,
      atrAbs: Number(atr.toFixed(5)), // абсолютне значення ATR
      atrPct: Number(atrPct.toFixed(2)),
      window,
      thresholds: volatilityFilter,
    },
  };
}
