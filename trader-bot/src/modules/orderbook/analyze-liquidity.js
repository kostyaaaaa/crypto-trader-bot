// modules/orderbook/analyze-liquidity.js
// Читає хвилинні "ліквідність-свічки" з collection 'liquidity'
// (які пише OrderBookStepWS) і рахує LONG/SHORT силу + spreadPct.

import { loadDocs } from '../../storage/storage.js';
import { getLastPrice } from '../../utils/getLastPrice.js';

export async function analyzeLiquidity(symbol = 'ETHUSDT', window = 20) {
  // Беремо останні window хвилинних агрегатів ліквідності
  const liq = await loadDocs('liquidity', symbol, window);
  if (!liq || liq.length === 0) {
    console.log(`⚠️ No liquidity aggregates for ${symbol}`);
    return null;
  }

  // Середні по вікну
  const avgImbalance =
    liq.reduce((s, d) => s + (Number(d.avgImbalance) || 0), 0) / liq.length; // ~0..1
  const avgSpreadAbs =
    liq.reduce((s, d) => s + (Number(d.avgSpread) || 0), 0) / liq.length; // у цінах

  // Переводимо спред у % від поточної ціни (mid ≈ lastPrice)
  const lastPrice = await getLastPrice(symbol);
  const spreadPct =
    lastPrice && lastPrice > 0 ? (avgSpreadAbs / lastPrice) * 100 : null;

  // Силові бали на основі дисбалансу об’ємів у стакані
  // imbalanceBias: (-1..+1), 0 — баланс, >0 — перевага bids (лонгово)
  const bias = (avgImbalance - 0.5) * 2; // -1..+1
  const strength = Math.min(30, Math.abs(bias) * 40 * 10); // 0..30 (0.05 → ~20, 0.1 → 30)

  let LONG = 50,
    SHORT = 50;
  if (bias > 0) {
    LONG += strength;
    SHORT -= strength;
  } else if (bias < 0) {
    SHORT += strength;
    LONG -= strength;
  }

  return {
    symbol,
    LONG,
    SHORT,
    data: {
      window,
      avgImbalance: Number(avgImbalance.toFixed(3)),
      avgSpreadAbs: Number(avgSpreadAbs.toFixed(6)),
      spreadPct: spreadPct != null ? Number(spreadPct.toFixed(3)) : null,
    },
    // для зручності доступу в engine
    spreadPct: spreadPct != null ? Number(spreadPct.toFixed(3)) : null,
  };
}
