// analyze-volatility.js
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
    console.log(`⚠️ Not enough candles for ${symbol}, need ${window + 1}`);
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

  let LONG = 0;
  let SHORT = 0;
  let status = 'NORMAL';

  if (atrPct < volatilityFilter.deadBelow) {
    status = 'DEAD';
  } else if (atrPct > volatilityFilter.extremeAbove) {
    status = 'EXTREME';
    LONG = SHORT = 100; // ринок активний, але надто дикий
  } else {
    // нормальний ринок → сила від ATR
    const strength = Math.min(100, atrPct * 50);
    LONG = strength;
    SHORT = strength;
  }

  return {
    symbol,
    LONG,
    SHORT,
    status, // нове поле
    data: {
      candlesUsed: trs.length,
      atr: atr.toFixed(5),
      atrPct: atrPct.toFixed(2),
    },
  };
}
