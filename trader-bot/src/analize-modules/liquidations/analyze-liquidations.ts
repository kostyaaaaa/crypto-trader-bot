import { type ILiquidationsModule, type ILiquidations as LiquidationCandle } from 'crypto-trader-db';
import { loadDocs } from '../../storage/storage.ts';

const MAX_COUNT = 10 as const;
const MAX_AGE_MIN = 30 as const;

export async function analyzeLiquidations(
  symbol: string = 'ETHUSDT',
): Promise<ILiquidationsModule | null> {
  const raw = (await loadDocs('liquidations', symbol, MAX_COUNT)) as
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
    return null;
  }

  const newestTs = new Date(
    liquidations[0]?.time ?? liquidations[0]?.createdAt ?? 0,
  ).getTime();
  const ageMin = newestTs ? (Date.now() - newestTs) / 60000 : Infinity;
  if (ageMin > MAX_AGE_MIN) {
    return null;
  }

  const avgBuy =
    liquidations.reduce((s, c) => s + Number(c.buysValue || 0), 0) /
    liquidations.length;
  const avgSell =
    liquidations.reduce((s, c) => s + Number(c.sellsValue || 0), 0) /
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

  const buyPct = (avgBuy / total) * 100;
  const sellPct = (avgSell / total) * 100;

  let signal: string = 'NEUTRAL';
  if (buyPct > sellPct + 10) signal = 'LONG';
  else if (sellPct > buyPct + 10) signal = 'SHORT';

  const longScore = Math.round(buyPct);
  const shortScore = Math.round(sellPct);

  return {
    module: 'liquidations',
    symbol,
    signal,
    strength: Math.max(longScore, shortScore),
    meta: {
      LONG: longScore,
      SHORT: shortScore,
      candlesUsed: liquidations.length,
      avgBuy: Number(avgBuy.toFixed(2)),
      avgSell: Number(avgSell.toFixed(2)),
      buyPct: Number(buyPct.toFixed(1)),
      sellPct: Number(sellPct.toFixed(1)),
    },
  };
}
