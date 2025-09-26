// modules/liquidations/analyze-liquidations.js
// --- Аналізує дані ліквідацій ---
// buysValue → ріжуть шорти → ціна зростає → LONG
// sellsValue → ріжуть лонги → ціна падає → SHORT

import { log } from 'console';
import { loadDocs } from '../../storage/storage.js';

export async function analyzeLiquidations(symbol = 'ETHUSDT', window = 5) {
  const liquidations = await loadDocs('liquidations', symbol, window);
  if (!liquidations || liquidations.length < window) {
    console.log(
      `⚠️ Not enough liquidations data for ${symbol}, need ${window}`,
    );
    return null;
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
