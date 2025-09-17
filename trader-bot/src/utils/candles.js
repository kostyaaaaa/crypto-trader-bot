// utils/candles.js
export function aggregateCandles(candles, timeframe = '1m') {
  if (timeframe === '1m') return candles;

  if (timeframe === '5m') {
    const grouped = [];
    for (let i = 0; i < candles.length; i += 5) {
      const chunk = candles.slice(i, i + 5);
      if (chunk.length < 5) continue;

      grouped.push({
        time: chunk[0].time, // час першої свічки
        open: chunk[0].open,
        close: chunk[chunk.length - 1].close,
        high: Math.max(...chunk.map((c) => c.high)),
        low: Math.min(...chunk.map((c) => c.low)),
        volume: chunk.reduce((sum, c) => sum + c.volume, 0),
      });
    }
    return grouped;
  }

  throw new Error(`Unsupported timeframe: ${timeframe}`);
}
