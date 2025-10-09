import { Candle } from '../types/types';

export type Timeframe = '1m' | `${number}m` | `${number}h`;

export function aggregateCandles(
  candles: Candle[],
  timeframe: Timeframe = '1m',
): Candle[] {
  if (timeframe === '1m') return candles;

  const match = /^(\d+)([mh])$/.exec(timeframe);
  if (!match) throw new Error(`Unsupported timeframe: ${timeframe}`);

  let factor = parseInt(match[1], 10);
  if (!Number.isFinite(factor) || factor <= 0) {
    throw new Error(`Invalid timeframe factor: ${timeframe}`);
  }
  let bucketMs = factor * 60_000;
  if (match[2] === 'h') bucketMs *= 60;

  const sorted = [...candles].sort(
    (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime(),
  );

  const grouped: Candle[] = [];
  let bucket: Candle | null = null;
  let bucketStart: number | null = null;

  for (const c of sorted) {
    const ts = Date.parse(c.time);
    if (!Number.isFinite(ts)) continue;

    const thisBucketStart = Math.floor(ts / bucketMs) * bucketMs;

    if (!bucket || thisBucketStart !== bucketStart) {
      if (bucket && bucketStart != null) {
        if (Date.now() - bucketStart >= bucketMs) grouped.push(bucket);
      }

      bucketStart = thisBucketStart;
      bucket = {
        time: new Date(thisBucketStart).toISOString(),
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
      };
    } else {
      bucket.high = Math.max(bucket.high, c.high);
      bucket.low = Math.min(bucket.low, c.low);
      bucket.close = c.close;
      bucket.volume += c.volume;
    }
  }

  if (bucket && bucketStart != null) {
    if (Date.now() - bucketStart >= bucketMs) grouped.push(bucket);
  }

  return grouped;
}
