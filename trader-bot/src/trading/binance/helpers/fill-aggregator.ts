/**
 * Deduplication storage for ORDER_TRADE_UPDATE events
 */
const _processedOrderEvents: Map<string, number> = new Map();
const DEDUP_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Check if an order event was already processed (deduplication)
 */
export function isDuplicateOrderEvent(key: string): boolean {
  const now = Date.now();
  const ts = _processedOrderEvents.get(key);
  if (ts && now - ts < DEDUP_TTL_MS) return true;
  _processedOrderEvents.set(key, now);
  return false;
}

/**
 * Aggregate fills per order to compute VWAP
 */
const _orderAgg: Map<number, { q: number; notional: number }> = new Map();

/**
 * Add a fill to the aggregator
 */
export function addFillToAgg(
  orderId: number,
  qty: number,
  price: number,
): void {
  const agg = _orderAgg.get(orderId) || { q: 0, notional: 0 };
  agg.q += qty;
  agg.notional += price * qty;
  _orderAgg.set(orderId, agg);
}

/**
 * Get aggregated fill data and remove from cache
 */
export function getAndClearAgg(
  orderId: number,
): { qty: number; avgPx: number } | null {
  const agg = _orderAgg.get(orderId);
  if (!agg) return null;
  _orderAgg.delete(orderId);
  const avgPx = agg.q > 0 ? agg.notional / agg.q : 0;
  return { qty: agg.q, avgPx };
}

/**
 * Sum quantities from fills array
 */
export function sumFillsQty(
  fills: Array<{ qty?: number | string }> | undefined,
): number {
  if (!Array.isArray(fills)) return 0;
  let s = 0;
  for (const f of fills) s += Number(f?.qty) || 0;
  return s;
}

/**
 * Compute next monotonic cumulative quantity
 */
export function nextMonotonicCum(
  prevCum: number | string | undefined,
  evCum: number | string | undefined,
  deltaQty: number | string | undefined,
  fills: Array<{ qty?: number | string }> | undefined,
): number {
  const prev = Number(prevCum) || 0;
  const ev = Number(evCum);
  const hasEv = Number.isFinite(ev) && ev > 0;
  const sumF = sumFillsQty(fills);
  const candidate = hasEv ? ev : prev + (Number(deltaQty) || 0);
  return Math.max(prev, candidate, sumF);
}
