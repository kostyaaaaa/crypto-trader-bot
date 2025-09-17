// analyze-liquidity.js
// --- Аналізує дані ордербуку ---
// Середній дисбаланс між bid/ask → сила покупців чи продавців
// 0.5 = баланс, >0.5 → LONG, <0.5 → SHORT

import { loadDocs } from "../../storage/storage.js";

export async function analyzeLiquidity(symbol = "ETHUSDT", window = 20) {
  const liquidity = await loadDocs("liquidity", symbol, window);
  if (!liquidity || liquidity.length < window) {
    console.log(`⚠️ Not enough liquidity data for ${symbol}, need ${window}`);
    return null;
  }

  // середні показники
  const avgImbalance =
      liquidity.reduce((s, c) => s + parseFloat(c.avgImbalance), 0) /
      liquidity.length;

  const avgSpread =
      liquidity.reduce((s, c) => s + parseFloat(c.avgSpread), 0) /
      liquidity.length;

  // базові очки: відхилення від 0.5 (тобто рівноваги)
  const diff = avgImbalance - 0.5; // >0 → LONG, <0 → SHORT
  let longScore = 50 + diff * 200; // масштабуємо, щоб 0.6 = 70, 0.4 = 30
  let shortScore = 100 - longScore;

  // штраф за широкий спред: якщо avgSpread дуже великий, знижуємо впевненість
  const spreadPenalty = Math.min(avgSpread * 10, 20); // макс -20 балів
  longScore = Math.max(0, longScore - spreadPenalty / 2);
  shortScore = Math.max(0, shortScore - spreadPenalty / 2);

  // нормалізація в межах 0–100
  longScore = Math.round(Math.max(0, Math.min(100, longScore)));
  shortScore = Math.round(Math.max(0, Math.min(100, shortScore)));

  // сигнал
  let signal = "NEUTRAL";
  if (longScore > shortScore) signal = "LONG";
  else if (shortScore > longScore) signal = "SHORT";

  return {
    symbol,
    signal,
    LONG: longScore,
    SHORT: shortScore,
    data: {
      candlesUsed: liquidity.length,
      avgImbalance: avgImbalance.toFixed(3),
      avgSpread: avgSpread.toFixed(4),
    },
  };
}