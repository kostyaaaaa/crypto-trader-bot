import type { Candle } from '../../types/candles';

export interface IVolumeModule {
  type: 'scoring';
  module: 'volume';
  symbol: string;
  meta: {
    LONG: number;
    SHORT: number;
    volumeAvg: number;
    volumeRatio: number;
    volumeTrend: number;
    volumeSpike: number;
    candlesUsed: number;
  };
}

export async function analyzeVolume(
  symbol: string = 'ETHUSDT',
  candles: Candle[] = [],
): Promise<IVolumeModule | null> {
  const window = 20;
  const minNeeded = window + 1;

  if (!candles || candles.length < minNeeded) {
    return null;
  }

  const volumes = candles.map((c) => Number(c.volume ?? 0));
  const closes = candles.map((c) => c.close);
  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);

  // Calculate volume statistics
  // Volume average (only CLOSED candles, excluding current open candle)
  const closedVolumes = volumes.slice(0, -1); // All except the last (current open) candle
  const volumeAvg =
    closedVolumes.length > 0
      ? closedVolumes.reduce((sum, vol) => sum + vol, 0) / closedVolumes.length
      : 0;

  // Volume ratio (current open candle vs average of closed candles)
  const currentVolume = volumes[volumes.length - 1] || 0;
  const volumeRatio = volumeAvg > 0 ? currentVolume / volumeAvg : 1;

  // Volume trend (slope of volume over time, using only closed candles)
  const volumeTrend = calculateVolumeTrend(closedVolumes);

  // Volume spike detection (current open candle vs average of closed candles)
  const volumeSpike = detectVolumeSpike(volumes, volumeAvg);

  // Start with 50/50 split
  let longScore = 50;
  let shortScore = 50;

  // Volume ratio adjustment (current vs historical average)
  if (volumeRatio > 1.2) {
    longScore += 10;
    shortScore += 5; // High volume = more activity overall
  } else if (volumeRatio < 0.8) {
    longScore -= 5;
    shortScore -= 5; // Low volume = less activity overall
  }

  // Volume trend adjustment (growing vs declining volume)
  if (volumeTrend > 0.05) {
    longScore += 5;
    shortScore -= 5; // Growing volume = positive momentum
  } else if (volumeTrend < -0.05) {
    longScore -= 5;
    shortScore += 5; // Declining volume = negative momentum
  }

  // Clamp scores to 0-100
  longScore = Math.max(0, Math.min(100, longScore));
  shortScore = Math.max(0, Math.min(100, shortScore));

  return {
    type: 'scoring',
    module: 'volume',
    symbol,
    meta: {
      LONG: Number(longScore.toFixed(1)),
      SHORT: Number(shortScore.toFixed(1)),
      volumeAvg: Number(volumeAvg.toFixed(2)),
      volumeRatio: Number(volumeRatio.toFixed(2)),
      volumeTrend: Number(volumeTrend.toFixed(3)),
      volumeSpike: Number(volumeSpike.toFixed(2)),
      candlesUsed: window,
    },
  };
}

function calculateVolumeTrend(volumes: number[]): number {
  if (volumes.length < 2) return 0;

  const n = volumes.length;
  const sumX = (n * (n - 1)) / 2;
  const sumY = volumes.reduce((sum, vol) => sum + vol, 0);
  const sumXY = volumes.reduce((sum, vol, i) => sum + vol * i, 0);
  const sumX2 = volumes.reduce((sum, vol, i) => sum + i * i, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  return slope;
}

function detectVolumeSpike(volumes: number[], avgVolume: number): number {
  if (volumes.length === 0 || avgVolume === 0) return 1;

  const currentVolume = volumes[volumes.length - 1];
  return currentVolume / avgVolume;
}
