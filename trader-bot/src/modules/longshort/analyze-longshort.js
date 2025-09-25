// modules/longshort/analyze-longshort.js
// --- Глобальне співвідношення Long vs Short акаунтів ---
// Джерело: /futures/data/globalLongShortAccountRatio

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
  const avgLong = data.reduce((s, c) => s + (c.longPct || 0), 0) / data.length;
  const avgShort =
    data.reduce((s, c) => s + (c.shortPct || 0), 0) / data.length;

  // нормалізація
  const total = avgLong + avgShort;
  const longPct = total > 0 ? (avgLong / total) * 100 : 50;
  const shortPct = total > 0 ? (avgShort / total) * 100 : 50;

  let signal = 'NEUTRAL';
  if (longPct > shortPct + 5) signal = 'LONG';
  else if (shortPct > longPct + 5) signal = 'SHORT';

  // strength = різниця між LONG і SHORT
  const strength = Math.min(100, Math.abs(longPct - shortPct));

  return {
    module: 'longShort',
    symbol,
    signal, // LONG | SHORT | NEUTRAL
    strength, // наскільки великий перекос (0..100)
    meta: {
      LONG: Number(longPct.toFixed(2)),
      SHORT: Number(shortPct.toFixed(2)),
      candlesUsed: data.length,
      avgLong: Number(avgLong.toFixed(2)),
      avgShort: Number(avgShort.toFixed(2)),
    },
  };
}
