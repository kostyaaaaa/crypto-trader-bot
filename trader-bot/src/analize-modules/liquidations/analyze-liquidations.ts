import {
  type ILiquidationsModule,
  type ILiquidations as LiquidationCandle,
} from 'crypto-trader-db';
import { getLiquidations } from '../../api';

const CURRENT_RECORDS = 24 as const;
const HISTORICAL_RECORDS = 100 as const;
const MAX_AGE_MIN = 30 as const;

export async function analyzeLiquidations(
  symbol: string = 'ETHUSDT',
): Promise<ILiquidationsModule | null> {
  // Get all liquidations data in one call
  const raw = (await getLiquidations(symbol, HISTORICAL_RECORDS)) as
    | LiquidationCandle[]
    | null
    | undefined;

  const sorted: LiquidationCandle[] = Array.isArray(raw)
    ? [...raw].sort(
        (a, b) =>
          new Date(b?.time ?? b?.createdAt ?? 0).getTime() -
          new Date(a?.time ?? a?.createdAt ?? 0).getTime(),
      )
    : [];

  if (!sorted || sorted.length === 0) {
    return {
      type: 'validation',
      module: 'liquidations',
      symbol,
      signal: 'NEUTRAL',
      meta: {
        candlesUsed: 0,
        avgBuy: 0,
        avgSell: 0,
        buyPct: 0,
        sellPct: 0,
      },
    };
  }

  // Use most recent records for current analysis
  const currentLiquidations = sorted.slice(0, CURRENT_RECORDS);

  const newestTs = new Date(
    currentLiquidations[0]?.time ?? currentLiquidations[0]?.createdAt ?? 0,
  ).getTime();
  const ageMin = newestTs ? (Date.now() - newestTs) / 60000 : Infinity;
  if (ageMin > MAX_AGE_MIN) {
    return {
      type: 'validation',
      module: 'liquidations',
      symbol,
      signal: 'NEUTRAL',
      meta: {
        candlesUsed: 0,
        avgBuy: 0,
        avgSell: 0,
        buyPct: 0,
        sellPct: 0,
      },
    };
  }

  const avgBuy =
    currentLiquidations.reduce((s, c) => s + Number(c.buysValue || 0), 0) /
    currentLiquidations.length;
  const avgSell =
    currentLiquidations.reduce((s, c) => s + Number(c.sellsValue || 0), 0) /
    currentLiquidations.length;

  const currentTotal = avgBuy + avgSell;
  const buyPct = currentTotal > 0 ? (avgBuy / currentTotal) * 100 : 50;
  const sellPct = currentTotal > 0 ? (avgSell / currentTotal) * 100 : 50;

  // Calculate dynamic threshold using the same data
  const dynamicThreshold = calculateDynamicThreshold(sorted);

  // Determine signal based on dynamic threshold
  let signal: 'ACTIVE' | 'NEUTRAL' | 'INACTIVE' = 'ACTIVE';

  if (dynamicThreshold === null) {
    // No historical data or API failure - neutral signal
    signal = 'NEUTRAL';
  } else if (currentTotal > dynamicThreshold) {
    signal = 'INACTIVE'; // Too extreme - liquidation cascade
  } else if (currentTotal > dynamicThreshold * 0.7) {
    signal = 'NEUTRAL'; // Warning zone
  } else {
    signal = 'ACTIVE'; // Safe to trade
  }

  return {
    type: 'validation',
    module: 'liquidations',
    symbol,
    signal,
    meta: {
      candlesUsed: currentLiquidations.length,
      avgBuy: Number(avgBuy.toFixed(2)),
      avgSell: Number(avgSell.toFixed(2)),
      buyPct: Number(buyPct.toFixed(1)),
      sellPct: Number(sellPct.toFixed(1)),
    },
  };
}

/**
 * Calculate dynamic threshold using consistent record counts
 */
function calculateDynamicThreshold(
  historicalData: LiquidationCandle[],
): number | null {
  try {
    if (!Array.isArray(historicalData) || historicalData.length === 0) {
      return null; // No data available
    }

    // Use all available historical data (up to HISTORICAL_RECORDS)
    const recentData = historicalData;

    if (recentData.length === 0) {
      return null; // No data available
    }

    // Calculate total liquidation values
    const totalValues = recentData
      .map((item) => Number(item.buysValue || 0) + Number(item.sellsValue || 0))
      .sort((a, b) => a - b);

    // Calculate 90th percentile (conservative threshold)
    const hist90 = calculatePercentile(totalValues, 90);

    // Calculate rolling mean and std dev from recent data (same count as current analysis)
    const recentValues = totalValues.slice(-CURRENT_RECORDS); // Last 24 records
    const rollingMean =
      recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    const rollingStd = calculateStandardDeviation(recentValues, rollingMean);

    // Use the maximum of both approaches (more conservative)
    const dynamicThreshold = Math.max(hist90, rollingMean + 2 * rollingStd);

    return dynamicThreshold;
  } catch (error) {
    console.warn(`Failed to calculate dynamic threshold:`, error);
    return null;
  }
}

/**
 * Calculate percentile of an array
 */
function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const index = (percentile / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index % 1;

  if (upper >= sorted.length) return sorted[sorted.length - 1];
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

/**
 * Calculate standard deviation
 */
function calculateStandardDeviation(values: number[], mean: number): number {
  if (values.length === 0) return 0;

  const squaredDiffs = values.map((value) => Math.pow(value - mean, 2));
  const avgSquaredDiff =
    squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  return Math.sqrt(avgSquaredDiff);
}
