// analyze-funding.js
// --- Аналізує середній Funding Rate за останні N свічок ---
// Якщо funding високий → забагато лонгерів → SHORT-сигнал
// Якщо funding низький → забагато шортерів → LONG-сигнал

import { loadDocs } from '../../storage/storage.js';

export async function analyzeFunding(symbol = 'ETHUSDT', window = 60) {
  const candles = await loadDocs('funding', symbol, window);

  if (!candles || candles.length < window) {
    console.log(`⚠️ Not enough funding data for ${symbol}, need ${window}`);
    return null;
  }

  // середній funding rate за період
  const avgFunding =
    candles.reduce((s, c) => s + (c.fundingRate || 0), 0) / candles.length;

  let signal = 'NONE';
  let LONG = 50;
  let SHORT = 50;

  // funding > 0 → перевага LONGів → SHORT
  if (avgFunding > 0) {
    signal = 'SHORT';
    SHORT = Math.min(100, 50 + avgFunding * 1000); // масштабуємо
    LONG = 100 - SHORT;
  }
  // funding < 0 → перевага SHORTів → LONG
  else if (avgFunding < 0) {
    signal = 'LONG';
    LONG = Math.min(100, 50 + Math.abs(avgFunding) * 1000);
    SHORT = 100 - LONG;
  }

  return {
    symbol,
    signal,
    LONG: Math.round(LONG),
    SHORT: Math.round(SHORT),
    data: {
      candlesUsed: candles.length,
      avgFunding: avgFunding.toFixed(5),
    },
  };
}
