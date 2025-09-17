// analyze-volatility.js
// --- Аналіз волатильності через ATR (Average True Range) ---
// Якщо ATR < 0.2% від ціни → ринок "мертвий" (нема руху)
// Якщо ATR > 0.2% → ринок "живий", віддаємо силу обом сторонам (LONG/SHORT)

import { loadDocs } from '../../storage/storage.js';

export async function analyzeVolatility(symbol = 'ETHUSDT', window = 14) {
  const candles = await loadDocs('candles', symbol, window + 1);

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

  // середній TR = ATR
  const atr = trs.reduce((s, v) => s + v, 0) / trs.length;

  // ATR у відсотках від останнього close
  const lastClose = recent[recent.length - 1].close;
  const atrPct = (atr / lastClose) * 100;

  let LONG = 0;
  let SHORT = 0;

  // Якщо ринок мертвий → обидва = 0
  if (atrPct >= 0.2) {
    // нормалізуємо силу: ATR% = 0.2 → сила 10, ATR% = 1 → сила 50, ATR% > 2 → макс 100
    const strength = Math.min(100, atrPct * 50);
    LONG = strength;
    SHORT = strength;
  }

  return {
    symbol,
    LONG,
    SHORT,
    data: {
      candlesUsed: trs.length,
      atr: atr.toFixed(2),
      atrPct: atrPct.toFixed(2),
    },
  };
}
