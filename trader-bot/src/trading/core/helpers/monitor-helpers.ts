import type { Side } from '../../../types';
import markPriceHub from '../mark-price-hub';

/**
 * Get mark price from hub
 */
export async function getMarkFromHub(symbol: string): Promise<number | null> {
  const m = markPriceHub.getMark(symbol);
  if (m && !m.stale) return Number(m.markPrice);
  const first = await markPriceHub.waitForMark(symbol);
  return first?.markPrice ?? null;
}

/**
 * Get side from analysis record (bias or signal)
 */
export function getAnaSide(
  a: { bias?: Side | 'NEUTRAL'; signal?: Side | 'NEUTRAL' } | null | undefined,
): Side | 'NEUTRAL' | null {
  return (a?.bias ?? a?.signal) || null;
}

/**
 * Round quantity to 3 decimal places
 */
export function roundQty(q: number): number {
  const n = Number(q) || 0;
  return Number(n.toFixed(3));
}

export const TRADE_MODE = process.env.TRADE_MODE || 'paper';
