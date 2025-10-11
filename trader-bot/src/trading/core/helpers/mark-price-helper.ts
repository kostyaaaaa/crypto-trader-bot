import markPriceHub from '../mark-price-hub';

/**
 * Gets realtime mark price from the mark price hub
 * @param symbol - Trading symbol (e.g., 'BTCUSDT')
 * @returns Mark price or null if unavailable
 */
export async function getRealtimeMark(symbol: string): Promise<number | null> {
  const m = markPriceHub.getMark(symbol);
  if (m && !m.stale) return Number(m.markPrice);
  const first = await markPriceHub.waitForMark(symbol);
  return first?.markPrice ?? null;
}
