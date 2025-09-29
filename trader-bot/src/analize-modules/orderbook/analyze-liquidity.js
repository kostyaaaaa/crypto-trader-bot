import { loadDocs } from '../../storage/storage.js';

export async function analyzeLiquidity(
  symbol = 'ETHUSDT',
  window = 20,
  lastPrice = null,
) {
  const liq = await loadDocs('liquidity', symbol, window);

  if (!liq || liq.length === 0) {
    console.log(`⚠️ No liquidity aggregates for ${symbol}`);
    return null;
  }

  const avgImbalance =
    liq.reduce((s, d) => s + (Number(d.avgImbalance) || 0), 0) / liq.length;
  const avgSpreadAbs =
    liq.reduce((s, d) => s + (Number(d.avgSpread) || 0), 0) / liq.length;

  const spreadPct =
    lastPrice && lastPrice > 0 ? (avgSpreadAbs / lastPrice) * 100 : null;

  const clampedImb = Math.max(0, Math.min(1, avgImbalance));
  const bias = (clampedImb - 0.5) * 2;

  const strength = Math.min(100, Math.abs(bias) * 100);

  let signal = 'NEUTRAL';
  if (bias > 0.05) signal = 'LONG';
  else if (bias < -0.05) signal = 'SHORT';

  let LONG = 0,
    SHORT = 0;
  if (signal === 'LONG') {
    LONG = strength;
  } else if (signal === 'SHORT') {
    SHORT = strength;
  }

  return {
    module: 'liquidity',
    symbol,
    signal,
    strength,
    meta: {
      window,
      avgImbalance: Number(avgImbalance.toFixed(3)),
      avgSpreadAbs: Number(avgSpreadAbs.toFixed(6)),
      spreadPct: spreadPct != null ? Number(spreadPct.toFixed(3)) : null,
      LONG,
      SHORT,
    },
    spreadPct: spreadPct != null ? Number(spreadPct.toFixed(3)) : null,
  };
}
