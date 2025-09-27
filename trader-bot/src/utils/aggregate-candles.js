// utils/candles.js
export function aggregateCandles(candles, timeframe = '1m') {
  if (timeframe === '1m') return candles;

  // парсимо TF → хвилини
  const match = timeframe.match(/^(\d+)([mh])$/);
  if (!match) throw new Error(`Unsupported timeframe: ${timeframe}`);
  let factor = parseInt(match[1], 10);
  if (match[2] === 'h') factor *= 60; // години → хвилини
  const bucketMs = factor * 60 * 1000;

  // важливо: свічки сортуємо
  candles.sort((a, b) => new Date(a.time) - new Date(b.time));

  const grouped = [];
  let bucket = null;
  let bucketStart = null;

  for (const c of candles) {
    const ts = new Date(c.time).getTime();
    const thisBucketStart = Math.floor(ts / bucketMs) * bucketMs;

    if (!bucket || thisBucketStart !== bucketStart) {
      // закриваємо попередній bucket
      if (bucket) grouped.push(bucket);

      bucketStart = thisBucketStart;
      bucket = {
        time: new Date(bucketStart).toISOString(),
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

  // ⚠️ Не пушимо останній bucket, якщо він ще не завершений
  if (bucket) {
    const now = Date.now();
    if (now - bucketStart >= bucketMs) {
      grouped.push(bucket);
    }
  }

  return grouped;
}
