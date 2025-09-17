// analyze-trend.js
// --- Трендовий аналіз через EMA та RSI ---
// EMA(9) vs EMA(21) → напрямок тренду
// RSI(14) → перепроданість/перекупленість

import { EMA, RSI } from '../../utils/getEMAAndRSI.js';
import { loadDocs } from '../../storage/storage.js';

export async function analyzeCandles(symbol = 'ETHUSDT') {
  const candles = await loadDocs('candles', symbol, 100);

  if (!candles || candles.length < 21) {
    console.log(
      `⏳ Only ${candles?.length || 0} candles for ${symbol}, need ≥21...`,
    );
    return null;
  }

  const closes = candles.map((c) => c.close);

  // EMA fast (9) і slow (21)
  const emaFast = EMA(closes, 9);
  const emaSlow = EMA(closes, 21);
  const emaGapPct = ((emaFast - emaSlow) / emaSlow) * 100; // відсотковий розрив

  // RSI(14)
  const rsi = RSI(closes, 14);

  // --- розрахунок сил ---
  let longScore = 50;
  let shortScore = 50;

  // EMA: розрив між 9 і 21
  if (emaGapPct > 0) {
    longScore += Math.min(30, Math.abs(emaGapPct) * 5); // чим більший розрив → тим сильніше LONG
    shortScore -= Math.min(30, Math.abs(emaGapPct) * 5);
  } else {
    shortScore += Math.min(30, Math.abs(emaGapPct) * 5);
    longScore -= Math.min(30, Math.abs(emaGapPct) * 5);
  }

  // RSI
  if (rsi < 30) {
    longScore += 20; // перепроданість → LONG
    shortScore -= 20;
  } else if (rsi > 70) {
    shortScore += 20; // перекупленість → SHORT
    longScore -= 20;
  }

  // нормалізуємо в діапазоні 0–100
  longScore = Math.max(0, Math.min(100, longScore));
  shortScore = Math.max(0, Math.min(100, shortScore));

  // визначаємо сигнал
  let signal = 'NEUTRAL';
  if (longScore > shortScore) signal = 'LONG';
  else if (shortScore > longScore) signal = 'SHORT';

  return {
    symbol,
    signal,
    LONG: longScore,
    SHORT: shortScore,
    data: {
      emaFast: emaFast.toFixed(2),
      emaSlow: emaSlow.toFixed(2),
      emaGapPct: emaGapPct.toFixed(2),
      rsi: rsi.toFixed(2),
    },
  };
}
