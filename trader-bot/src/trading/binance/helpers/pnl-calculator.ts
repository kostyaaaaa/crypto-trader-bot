import type { IPosition } from 'crypto-trader-db';

/**
 * Safe number parser
 */
export const n = (v: unknown): number => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

/**
 * Calculate PnL from a fill (gross, excluding fees)
 */
export function calcFillPnl(
  entryPrice: number | string | null | undefined,
  fillPrice: number | string | null | undefined,
  qty: number | string | null | undefined,
  posSide: 'LONG' | 'SHORT' | null | undefined,
): number {
  const entry = n(entryPrice);
  const fill = n(fillPrice);
  const q = n(qty);
  if (!(entry > 0 && fill > 0 && q > 0)) return 0;
  const dir = posSide === 'LONG' ? 1 : -1;
  return (fill - entry) * q * dir;
}

/**
 * Sum realized PnL from all TP fills
 */
export function sumTpRealizedPnl(
  pos:
    | Pick<IPosition, 'takeProfits' | 'entryPrice' | 'side'>
    | null
    | undefined,
): number {
  if (!pos || !Array.isArray(pos.takeProfits)) return 0;
  let sum = 0;
  for (const tp of pos.takeProfits) {
    if (!tp || !Array.isArray((tp as any).fills)) continue;
    for (const f of (tp as any).fills as Array<{
      qty?: number | string;
      price?: number | string;
    }>) {
      sum += calcFillPnl(
        pos.entryPrice as number,
        f.price,
        f.qty,
        pos.side as any,
      );
    }
  }
  return sum;
}
