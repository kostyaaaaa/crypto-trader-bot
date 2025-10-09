import type { Side } from './types.ts';

export function validateStop(
  side: Side,
  entryRef: number,
  currentRef: number,
  stopPrice: number,
): boolean {
  if (!Number.isFinite(stopPrice) || !Number.isFinite(entryRef)) return false;

  const okVsEntry =
    side === 'LONG' ? stopPrice < entryRef : stopPrice > entryRef;
  if (!okVsEntry) return false;

  if (Number.isFinite(currentRef)) {
    const okVsCurrent =
      side === 'LONG' ? stopPrice < currentRef : stopPrice > currentRef;
    if (!okVsCurrent) return false;
  }
  return true;
}
