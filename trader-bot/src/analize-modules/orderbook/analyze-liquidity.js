import { loadDocs } from '../../storage/storage.js';
import logger from '../../utils/db-logger.js';

export async function analyzeLiquidity(
  symbol = 'ETHUSDT',
  window = 20,
  lastPrice = null,
) {
  const liq = await loadDocs('liquidity', symbol, window);

  if (!liq || liq.length === 0) {
    logger.warn(`⚠️ No liquidity aggregates for ${symbol}`);
    return null;
  }

  const avgImbalance =
    liq.reduce((s, d) => s + (Number(d.avgImbalance) || 0), 0) / liq.length;
  const avgSpreadAbs =
    liq.reduce((s, d) => s + (Number(d.avgSpread) || 0), 0) / liq.length;

  const spreadPct =
    lastPrice && lastPrice > 0 ? (avgSpreadAbs / lastPrice) * 100 : null;

  // Нормалізуємо imbalance: 0..1, де 0.5 = баланс попиту/пропозиції
  const clampedImb = Math.max(
    0,
    Math.min(1, Number.isFinite(avgImbalance) ? avgImbalance : 0.5),
  );

  // Переводимо у симетричні бали 0..100 по кожній стороні (сума ≈ 100)
  // 0.5 => LONG=50, SHORT=50; 0.6 => LONG=60, SHORT=40; 0.4 => LONG=40, SHORT=60
  const LONG = Number((clampedImb * 100).toFixed(3));
  const SHORT = Number(((1 - clampedImb) * 100).toFixed(3));

  // Дедзона навколо 50% (2%): не даємо фліпитись на шумі
  const deadZone = 0.02;
  const diff = Math.abs(clampedImb - 0.5);

  let signal = 'NEUTRAL';
  if (diff > deadZone) {
    signal = clampedImb > 0.5 ? 'LONG' : 'SHORT';
  }

  // strength — сила переважаючої сторони
  const strength = Math.max(LONG, SHORT);

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
