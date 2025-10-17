import { isLotFilter, type SymbolFilter } from '../../../types';

export function adjustQuantity(
  symbolFilters: SymbolFilter[],
  qty: number | string,
): string {
  const lotFilter = symbolFilters.find(isLotFilter);
  if (!lotFilter) return String(qty);

  const stepSizeNum = parseFloat(lotFilter.stepSize);
  const minQtyNum = parseFloat(lotFilter.minQty);

  if (!Number.isFinite(stepSizeNum) || stepSizeNum <= 0) return String(qty);

  const precision =
    stepSizeNum === 1 ? 0 : (stepSizeNum.toString().split('.')[1] || '').length;

  let q = Math.floor(Number(qty) / stepSizeNum) * stepSizeNum;
  if (!Number.isFinite(q) || q <= 0) q = 0;
  if (q < minQtyNum) q = 0;

  return q.toFixed(precision);
}
