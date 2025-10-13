import type { ILiquidityModule } from 'crypto-trader-db';
import { getLiquidity } from '../../api';
import logger from '../../utils/db-logger';
export async function analyzeLiquidity(
  symbol: string = 'ETHUSDT',
  window: number = 20,
  lastPrice: number | null = null,
): Promise<ILiquidityModule | null> {
  const liq = (await getLiquidity(symbol, window)) as Array<{
    avgImbalance: number | string;
    avgSpread: number | string;
  }>;

  if (liq.length === 0) {
    logger.warn(`⚠️ No liquidity aggregates for ${symbol}`);
    return null;
  }

  const avgImbalance =
    liq.reduce((s, d) => s + (Number(d.avgImbalance) || 0), 0) / liq.length;

  const avgSpreadAbs =
    liq.reduce((s, d) => s + (Number(d.avgSpread) || 0), 0) / liq.length;

  const spreadPct =
    lastPrice && lastPrice > 0 ? (avgSpreadAbs / lastPrice) * 100 : null;

  const clampedImb = Math.max(
    0,
    Math.min(1, Number.isFinite(avgImbalance) ? avgImbalance : 0.5),
  );

  // Calculate independent scores for LONG and SHORT (0-100 each)
  // Based on order book imbalance
  const LONG = Number((clampedImb * 100).toFixed(3));
  const SHORT = Number(((1 - clampedImb) * 100).toFixed(3));

  const spreadPctRounded =
    spreadPct != null ? Number(spreadPct.toFixed(3)) : null;

  return {
    type: 'scoring',
    module: 'liquidity',
    symbol,
    meta: {
      window,
      avgImbalance: Number(avgImbalance.toFixed(3)),
      avgSpreadAbs: Number(avgSpreadAbs.toFixed(6)),
      spreadPct: spreadPctRounded,
      LONG,
      SHORT,
    },
  };
}
