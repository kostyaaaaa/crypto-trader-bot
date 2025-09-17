// analyze-longshort.js
// --- Аналізує глобальне співвідношення Long vs Short акаунтів ---
// Джерело: /futures/data/globalLongShortAccountRatio (step зберігає у storage)

import { loadDocs } from '../../storage/storage.js';

export async function analyzeLongShort(symbol = 'ETHUSDT', window = 5) {
  const data = await loadDocs('longshort', symbol, window);

  if (!data || data.length < window) {
    console.log(
      `⚠️ Not enough long/short ratio data for ${symbol}, need ${window}`,
    );
    return null;
  }

  // середні значення
  const avgLong = data.reduce((s, c) => s + c.longPct, 0) / data.length;
  const avgShort = data.reduce((s, c) => s + c.shortPct, 0) / data.length;

  // нормалізація: щоб у сумі було 100
  const total = avgLong + avgShort;
  const longPct = total > 0 ? (avgLong / total) * 100 : 50;
  const shortPct = total > 0 ? (avgShort / total) * 100 : 50;

  return {
    symbol,
    candlesUsed: data.length,
    longPct: longPct.toFixed(2),
    shortPct: shortPct.toFixed(2),
    LONG: Math.round(longPct),
    SHORT: Math.round(shortPct),
  };
}
