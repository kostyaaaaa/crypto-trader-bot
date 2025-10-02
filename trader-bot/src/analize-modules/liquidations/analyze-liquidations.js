// modules/liquidations/analyze-liquidations.js
// --- Аналізує дані ліквідацій ---
// buysValue → ріжуть шорти → ціна зростає → LONG
// sellsValue → ріжуть лонги → ціна падає → SHORT

import { loadDocs } from '../../storage/storage.js';

// Usage:
// - analyzeLiquidations('ETHUSDT') → бере ОСТАННІ 10 записів; якщо найновіший старше 30 хв — повертає null
const MAX_COUNT = 10; // скільки точок беремо
const MAX_AGE_MIN = 30; // дані мають бути свіжішими за 30 хв

export async function analyzeLiquidations(symbol = 'ETHUSDT') {
  // Тягнемо останні MAX_COUNT записів, сортуємо найновіші → найстаріші
  const raw = await loadDocs('liquidations', symbol, MAX_COUNT);
  const sorted = Array.isArray(raw)
    ? [...raw].sort(
        (a, b) =>
          new Date(b?.time || b?.createdAt || 0) -
          new Date(a?.time || a?.createdAt || 0),
      )
    : [];

  const liquidations = sorted.slice(0, MAX_COUNT);

  if (!liquidations || liquidations.length === 0) {
    return null;
  }

  // Перевіряємо свіжість: найновіший запис має бути ≤ MAX_AGE_MIN хв
  const newestTs = new Date(
    liquidations[0]?.time || liquidations[0]?.createdAt || 0,
  ).getTime();
  const ageMin = newestTs ? (Date.now() - newestTs) / 60000 : Infinity;
  if (ageMin > MAX_AGE_MIN) {
    return null; // дані застарілі — модуль не впливає на скор
  }

  const avgBuy =
    liquidations.reduce((s, c) => s + parseFloat(c.buysValue || 0), 0) /
    liquidations.length;
  const avgSell =
    liquidations.reduce((s, c) => s + parseFloat(c.sellsValue || 0), 0) /
    liquidations.length;

  const total = avgBuy + avgSell;

  if (total === 0) {
    return {
      module: 'liquidations',
      symbol,
      signal: 'NEUTRAL',
      strength: 0,
      meta: {
        LONG: 50,
        SHORT: 50,
        candlesUsed: liquidations.length,
        avgBuy: 0,
        avgSell: 0,
        buyPct: 0,
        sellPct: 0,
      },
    };
  }

  const buyPct = (avgBuy / total) * 100; // сила на LONG
  const sellPct = (avgSell / total) * 100; // сила на SHORT

  let signal = 'NEUTRAL';
  if (buyPct > sellPct + 10) signal = 'LONG';
  else if (sellPct > buyPct + 10) signal = 'SHORT';

  const longScore = Math.round(buyPct);
  const shortScore = Math.round(sellPct);

  return {
    module: 'liquidations',
    symbol,
    signal, // LONG | SHORT | NEUTRAL
    strength: Math.max(longScore, shortScore),
    meta: {
      LONG: longScore,
      SHORT: shortScore,
      candlesUsed: liquidations.length,
      avgBuy: parseFloat(avgBuy.toFixed(2)),
      avgSell: parseFloat(avgSell.toFixed(2)),
      buyPct: parseFloat(buyPct.toFixed(1)),
      sellPct: parseFloat(sellPct.toFixed(1)),
    },
  };
}
