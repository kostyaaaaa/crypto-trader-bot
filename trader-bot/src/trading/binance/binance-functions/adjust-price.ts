import type { PriceFilter, SymbolFilter } from '../../../types';

function isPriceFilter(f: SymbolFilter): f is PriceFilter {
  return f?.filterType === 'PRICE_FILTER';
}

function precisionFromTick(tickSizeStr: string): number {
  if (!tickSizeStr) return 0;
  const dot = tickSizeStr.indexOf('.');
  if (dot === -1) return 0;
  const frac = tickSizeStr.slice(dot + 1);
  return frac.length;
}

export function adjustPrice(
  symbolFilters: SymbolFilter[],
  price: number | string,
): string {
  const n = Number(price);
  if (!Number.isFinite(n) || n <= 0) return '0';

  const pf = symbolFilters.find(isPriceFilter);
  if (!pf) return String(n);

  const tickStr = pf.tickSize ?? '0';
  const tick = Number(tickStr);
  if (!Number.isFinite(tick) || tick <= 0) return String(n);

  const precision = precisionFromTick(tickStr);
  const quantized = Math.floor(n / tick) * tick;

  if (!Number.isFinite(quantized) || quantized <= 0) return '0';
  return quantized.toFixed(precision);
}
