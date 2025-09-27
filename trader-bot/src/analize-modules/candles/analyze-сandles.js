// modules/candles/analyze-candles.js
// --- Трендовий аналіз через EMA та RSI ---
// EMA(9) vs EMA(21) → напрямок тренду
// RSI(14) → перепроданість/перекупленість

import { EMA, RSI } from '../../utils/getEMAAndRSI.js';

export async function analyzeCandles(symbol = 'ETHUSDT', candles = []) {
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
  const emaGapPct = ((emaFast - emaSlow) / emaSlow) * 100;

  // RSI(14)
  const rsi = RSI(closes, 14);

  // --- Силові бали ---
  let longScore = 50;
  let shortScore = 50;

  if (emaGapPct > 0) {
    longScore += Math.min(30, Math.abs(emaGapPct) * 5);
    shortScore -= Math.min(30, Math.abs(emaGapPct) * 5);
  } else {
    shortScore += Math.min(30, Math.abs(emaGapPct) * 5);
    longScore -= Math.min(30, Math.abs(emaGapPct) * 5);
  }

  if (rsi < 30) {
    longScore += 20;
    shortScore -= 20;
  } else if (rsi > 70) {
    shortScore += 20;
    longScore -= 20;
  }

  longScore = Math.max(0, Math.min(100, longScore));
  shortScore = Math.max(0, Math.min(100, shortScore));

  let signal = 'NEUTRAL';
  if (longScore > shortScore) signal = 'LONG';
  else if (shortScore > longScore) signal = 'SHORT';

  return {
    module: 'trend', // ← унікальний ідентифікатор
    symbol, // ← завжди повертаємо символ
    signal, // LONG | SHORT | NEUTRAL
    strength: Math.max(longScore, shortScore), // сила сигналу
    meta: {
      // вся додаткова інфа
      LONG: longScore,
      SHORT: shortScore,
      emaFast: parseFloat(emaFast.toFixed(2)),
      emaSlow: parseFloat(emaSlow.toFixed(2)),
      emaGapPct: parseFloat(emaGapPct.toFixed(2)),
      rsi: parseFloat(rsi.toFixed(2)),
    },
  };
}
