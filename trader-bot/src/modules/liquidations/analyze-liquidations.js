// analyze-liquidations.js
// --- Аналізує дані ліквідацій ---
// buysValue → ріжуть шорти → ціна зростає → LONG
// sellsValue → ріжуть лонги → ціна падає → SHORT

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

  // Якщо ліквідацій взагалі немає
  if (total === 0) {
    return {
      symbol,
      signal: 'NONE',
      LONG: 50,
      SHORT: 50,
      data: {
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

  // сигнал куди нахил
  let signal = 'NONE';
  if (buyPct > sellPct + 10) signal = 'LONG';
  else if (sellPct > buyPct + 10) signal = 'SHORT';

  return {
    symbol,
    signal,
    LONG: Math.round(buyPct),
    SHORT: Math.round(sellPct),
    data: {
      candlesUsed: liquidations.length,
      avgBuy: avgBuy.toFixed(2),
      avgSell: avgSell.toFixed(2),
      buyPct: buyPct.toFixed(1),
      sellPct: sellPct.toFixed(1),
    },
  };
}
