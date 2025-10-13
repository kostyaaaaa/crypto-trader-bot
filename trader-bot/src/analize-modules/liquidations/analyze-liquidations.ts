import {
  type ILiquidationsModule,
  type ILiquidations as LiquidationCandle,
} from 'crypto-trader-db';
import { getLiquidations } from '../../api';

const MAX_COUNT = 10 as const;
const MAX_AGE_MIN = 30 as const;

interface ILiquidationsFilter {
  minThreshold: number;
  maxThreshold: number;
}

export async function analyzeLiquidations(
  symbol: string = 'ETHUSDT',
  liquidationsFilter: ILiquidationsFilter = {
    minThreshold: 10000,
    maxThreshold: 1000000,
  },
): Promise<ILiquidationsModule | null> {
  const raw = (await getLiquidations(symbol, MAX_COUNT)) as
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

  const liquidations = sorted.slice(0, MAX_COUNT);

  if (!liquidations || liquidations.length === 0) {
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

  const newestTs = new Date(
    liquidations[0]?.time ?? liquidations[0]?.createdAt ?? 0,
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
    liquidations.reduce((s, c) => s + Number(c.buysValue || 0), 0) /
    liquidations.length;
  const avgSell =
    liquidations.reduce((s, c) => s + Number(c.sellsValue || 0), 0) /
    liquidations.length;

  const total = avgBuy + avgSell;
  const buyPct = total > 0 ? (avgBuy / total) * 100 : 50;
  const sellPct = total > 0 ? (avgSell / total) * 100 : 50;

  // Determine signal based on total liquidation volume
  let signal: 'ACTIVE' | 'NEUTRAL' | 'INACTIVE' = 'ACTIVE';

  if (total < liquidationsFilter.minThreshold) {
    signal = 'INACTIVE'; // Too low liquidation activity
  } else if (total > liquidationsFilter.maxThreshold) {
    signal = 'INACTIVE'; // Too extreme liquidation activity
  } else {
    signal = 'ACTIVE'; // Normal liquidation range
  }

  return {
    type: 'validation',
    module: 'liquidations',
    symbol,
    signal,
    meta: {
      candlesUsed: liquidations.length,
      avgBuy: Number(avgBuy.toFixed(2)),
      avgSell: Number(avgSell.toFixed(2)),
      buyPct: Number(buyPct.toFixed(1)),
      sellPct: Number(sellPct.toFixed(1)),
    },
  };
}
