// modules/orderbook/analyze-liquidity.js
// --- Аналіз ліквідності з ордербуку (через агреговані "ліквідність-свічки")

import { loadDocs } from '../../storage/storage.js';
import { getLastPrice } from '../../utils/getLastPrice.js';

export async function analyzeLiquidity(symbol = 'ETHUSDT', window = 20) {
  // Беремо останні window хвилинних агрегатів ліквідності
  const liq = await loadDocs('liquidity', symbol, window);
  if (!liq || liq.length === 0) {
    console.log(`⚠️ No liquidity aggregates for ${symbol}`);
    return null;
  }

  // Середні значення по вікну
  const avgImbalance =
    liq.reduce((s, d) => s + (Number(d.avgImbalance) || 0), 0) / liq.length; // ~0..1
  const avgSpreadAbs =
    liq.reduce((s, d) => s + (Number(d.avgSpread) || 0), 0) / liq.length; // у цінах

  // Спред у % від поточної ціни
  const lastPrice = await getLastPrice(symbol);
  const spreadPct =
    lastPrice && lastPrice > 0 ? (avgSpreadAbs / lastPrice) * 100 : null;

  // imbalanceBias: (-1..+1), 0 — баланс, >0 — перевага bids (лонгово)
  const bias = (avgImbalance - 0.5) * 2; // -1..+1
  const strength = Math.min(30, Math.abs(bias) * 400); // нормалізуємо у 0..30

  let signal = 'NEUTRAL';
  if (bias > 0.05) signal = 'LONG';
  else if (bias < -0.05) signal = 'SHORT';

  let LONG = 50,
    SHORT = 50;
  if (signal === 'LONG') {
    LONG += strength;
    SHORT -= strength;
  } else if (signal === 'SHORT') {
    SHORT += strength;
    LONG -= strength;
  }

  return {
    module: 'liquidity',
    symbol,
    signal, // LONG / SHORT / NEUTRAL
    strength, // 0..30
    meta: {
      window,
      avgImbalance: Number(avgImbalance.toFixed(3)),
      avgSpreadAbs: Number(avgSpreadAbs.toFixed(6)),
      spreadPct: spreadPct != null ? Number(spreadPct.toFixed(3)) : null,
      LONG,
      SHORT,
    },
    spreadPct: spreadPct != null ? Number(spreadPct.toFixed(3)) : null, // залишаємо для engine
  };
}
