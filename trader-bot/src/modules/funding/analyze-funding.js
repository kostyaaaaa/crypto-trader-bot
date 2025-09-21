// modules/funding/analyze-funding.js
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

  let signal = 'NEUTRAL';
  let longScore = 50;
  let shortScore = 50;

  // funding > 0 → перевага LONGів → SHORT-сигнал
  if (avgFunding > 0) {
    signal = 'SHORT';
    shortScore = Math.min(100, 50 + avgFunding * 1000); // масштабуємо
    longScore = 100 - shortScore;
  }
  // funding < 0 → перевага SHORTів → LONG-сигнал
  else if (avgFunding < 0) {
    signal = 'LONG';
    longScore = Math.min(100, 50 + Math.abs(avgFunding) * 1000);
    shortScore = 100 - longScore;
  }

  const roundedLong = Math.round(longScore);
  const roundedShort = Math.round(shortScore);

  return {
    module: 'funding',
    symbol,
    signal,                                      // LONG | SHORT | NEUTRAL
    strength: Math.max(roundedLong, roundedShort),
    meta: {
      LONG: roundedLong,
      SHORT: roundedShort,
      candlesUsed: candles.length,
      avgFunding: parseFloat(avgFunding.toFixed(5)),
    },
  };
}