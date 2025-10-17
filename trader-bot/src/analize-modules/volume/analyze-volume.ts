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
  const recentVolumes = volumes.slice(-window);
  const volumeAvg =
    recentVolumes.reduce((sum, vol) => sum + vol, 0) / recentVolumes.length;

  // Volume ratio (current vs average)
  const currentVolume = volumes[volumes.length - 1] || 0;
  const volumeRatio = volumeAvg > 0 ? currentVolume / volumeAvg : 1;

  // Volume trend (slope of volume over time)
  const volumeTrend = calculateVolumeTrend(recentVolumes);

  // Volume spike detection
  const volumeSpike = detectVolumeSpike(volumes, volumeAvg);

  // Price-volume relationship analysis
  const priceVolumeAnalysis = analyzePriceVolumeRelationship(
    volumes.slice(-window),
    closes.slice(-window),
    highs.slice(-window),
    lows.slice(-window),
  );

  // Start with 50/50 split
  let longScore = 50;
  let shortScore = 50;

  // Adjust based on volume supporting price direction
  if (priceVolumeAnalysis.volumeSupportsUpward) {
    const strength = Math.min(30, priceVolumeAnalysis.strength);
    longScore += strength;
    shortScore -= strength;
  } else if (priceVolumeAnalysis.volumeSupportsDownward) {
    const strength = Math.min(30, priceVolumeAnalysis.strength);
    shortScore += strength;
    longScore -= strength;
  }

  // Adjust for volume spikes (more volume = stronger signal)
  if (volumeSpike > 1.5) {
    const spikeBonus = Math.min(10, (volumeSpike - 1) * 5);
    if (longScore > shortScore) {
      longScore += spikeBonus;
      shortScore -= spikeBonus;
    } else if (shortScore > longScore) {
      shortScore += spikeBonus;
      longScore -= spikeBonus;
    }
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

function analyzePriceVolumeRelationship(
  volumes: number[],
  closes: number[],
  highs: number[],
  lows: number[],
): {
  volumeSupportsUpward: boolean;
  volumeSupportsDownward: boolean;
  strength: number;
} {
  if (volumes.length < 2) {
    return {
      volumeSupportsUpward: false,
      volumeSupportsDownward: false,
      strength: 0,
    };
  }

  // Calculate price changes
  const priceChanges = [];
  for (let i = 1; i < closes.length; i++) {
    const change = (closes[i] - closes[i - 1]) / closes[i - 1];
    priceChanges.push(change);
  }

  // Analyze volume on up vs down moves
  let upVolume = 0;
  let downVolume = 0;
  let upCount = 0;
  let downCount = 0;

  for (let i = 0; i < priceChanges.length; i++) {
    const volume = volumes[i + 1]; // Volume for the candle with the price change
    if (priceChanges[i] > 0) {
      upVolume += volume;
      upCount++;
    } else if (priceChanges[i] < 0) {
      downVolume += volume;
      downCount++;
    }
  }

  const avgUpVolume = upCount > 0 ? upVolume / upCount : 0;
  const avgDownVolume = downCount > 0 ? downVolume / downCount : 0;
  const totalAvgVolume = (upVolume + downVolume) / (upCount + downCount);

  // Determine if volume supports price direction
  const volumeSupportsUpward = avgUpVolume > totalAvgVolume * 1.1;
  const volumeSupportsDownward = avgDownVolume > totalAvgVolume * 1.1;

  // Calculate strength based on volume difference
  const strength = Math.min(
    30,
    (Math.abs(avgUpVolume - avgDownVolume) / totalAvgVolume) * 10,
  );

  return {
    volumeSupportsUpward,
    volumeSupportsDownward,
    strength,
  };
}
