// utils/candles.js
export function aggregateCandles(candles, timeframe = '1m') {
  if (timeframe === '1m') return candles;

  // парсимо TF → хвилини
  const match = timeframe.match(/^(\d+)([mh])$/);
  if (!match) throw new Error(`Unsupported timeframe: ${timeframe}`);
  let factor = parseInt(match[1], 10);
  if (match[2] === 'h') factor *= 60; // години → хвилини

  const grouped = [];
  let bucket = null;

  // важливо: свічки сортуємо
  candles.sort((a, b) => new Date(a.time) - new Date(b.time));

  for (const c of candles) {
    const ts = new Date(c.time).getTime();
    const bucketStart =
      Math.floor(ts / (factor * 60 * 1000)) * (factor * 60 * 1000);

    if (!bucket || bucket.time !== bucketStart) {
      if (bucket) grouped.push(bucket);

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

  if (bucket) grouped.push(bucket);
  return grouped;
}
