import type { Candle } from '../../types/candles';

export interface IMomentumModule {
  type: 'scoring';
  module: 'momentum';
  symbol: string;
  meta: {
    LONG: number;
    SHORT: number;
    momentum: number;
    acceleration: number;
    velocity: number;
    momentumStrength: number;
    candlesUsed: number;
  };
}

export async function analyzeMomentum(
  symbol: string = 'ETHUSDT',
  candles: Candle[] = [],
): Promise<IMomentumModule | null> {
  const window = 14;
  const minNeeded = window + 2; // Need extra for acceleration calculation

  if (!candles || candles.length < minNeeded) {
    return null;
  }

  const closes = candles.map((c) => c.close);
  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);

  // Calculate price changes (velocity)
  const priceChanges = [];
  for (let i = 1; i < closes.length; i++) {
    const change = (closes[i] - closes[i - 1]) / closes[i - 1];
    priceChanges.push(change);
  }

  // Calculate acceleration (change in velocity)
  const accelerations = [];
  for (let i = 1; i < priceChanges.length; i++) {
    const acceleration = priceChanges[i] - priceChanges[i - 1];
    accelerations.push(acceleration);
  }

  // Use recent data for analysis
  const recentChanges = priceChanges.slice(-window);
  const recentAccelerations = accelerations.slice(-window);

  // Calculate momentum metrics
  const momentum = calculateMomentum(recentChanges);
  const acceleration = calculateAcceleration(recentAccelerations);
  const velocity = recentChanges[recentChanges.length - 1] || 0;
  const momentumStrength = calculateMomentumStrength(
    recentChanges,
    recentAccelerations,
  );

  // Start with 50/50 split
  let longScore = 50;
  let shortScore = 50;

  // Adjust based on momentum direction and strength
  if (momentum > 0.001) {
    // Positive momentum
    const strength = Math.min(40, Math.abs(momentum) * 1000);
    longScore += strength;
    shortScore -= strength;
  } else if (momentum < -0.001) {
    // Negative momentum
    const strength = Math.min(40, Math.abs(momentum) * 1000);
    shortScore += strength;
    longScore -= strength;
  }

  // Adjust for acceleration (momentum building)
  if (Math.abs(acceleration) > 0.0005) {
    const accelBonus = Math.min(15, Math.abs(acceleration) * 2000);
    if (acceleration > 0 && momentum > 0) {
      // Positive acceleration with positive momentum
      longScore += accelBonus;
      shortScore -= accelBonus;
    } else if (acceleration < 0 && momentum < 0) {
      // Negative acceleration with negative momentum
      shortScore += accelBonus;
      longScore -= accelBonus;
    }
  }

  // Adjust for velocity (current speed)
  if (Math.abs(velocity) > 0.002) {
    const velocityBonus = Math.min(10, Math.abs(velocity) * 2000);
    if (velocity > 0) {
      longScore += velocityBonus;
      shortScore -= velocityBonus;
    } else {
      shortScore += velocityBonus;
      longScore -= velocityBonus;
    }
  }

  // Clamp scores to 0-100
  longScore = Math.max(0, Math.min(100, longScore));
  shortScore = Math.max(0, Math.min(100, shortScore));

  return {
    type: 'scoring',
    module: 'momentum',
    symbol,
    meta: {
      LONG: Number(longScore.toFixed(1)),
      SHORT: Number(shortScore.toFixed(1)),
      momentum: Number(momentum.toFixed(6)),
      acceleration: Number(acceleration.toFixed(6)),
      velocity: Number(velocity.toFixed(6)),
      momentumStrength: Number(momentumStrength.toFixed(3)),
      candlesUsed: window,
    },
  };
}

function calculateMomentum(priceChanges: number[]): number {
  if (priceChanges.length === 0) return 0;

  // Simple momentum as average of recent price changes
  const sum = priceChanges.reduce((acc, change) => acc + change, 0);
  return sum / priceChanges.length;
}

function calculateAcceleration(accelerations: number[]): number {
  if (accelerations.length === 0) return 0;

  // Average acceleration over the period
  const sum = accelerations.reduce((acc, a) => acc + a, 0);
  return sum / accelerations.length;
}

function calculateMomentumStrength(
  priceChanges: number[],
  accelerations: number[],
): number {
  if (priceChanges.length === 0) return 0;

  // Calculate momentum strength based on consistency and magnitude
  const momentum = Math.abs(calculateMomentum(priceChanges));
  const acceleration = Math.abs(calculateAcceleration(accelerations));

  // Consistency factor (how consistent is the direction)
  const positiveChanges = priceChanges.filter((change) => change > 0).length;
  const negativeChanges = priceChanges.filter((change) => change < 0).length;
  const consistency =
    Math.max(positiveChanges, negativeChanges) / priceChanges.length;

  // Combined strength
  const strength = (momentum * 1000 + acceleration * 1000) * consistency;
  return Math.min(1, strength);
}
