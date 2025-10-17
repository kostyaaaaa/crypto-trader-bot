export interface IMarketHoursModule {
  type: 'validation';
  module: 'marketHours';
  symbol: string;
  signal: 'ACTIVE' | 'NEUTRAL' | 'INACTIVE';
  meta: {
    currentHour: number;
    timezone: string;
    tradingSession: string;
    liquidityLevel: string;
    candlesUsed: number;
  };
}

export async function analyzeMarketHours(
  symbol: string = 'ETHUSDT',
): Promise<IMarketHoursModule | null> {
  const now = new Date();
  const currentHour = now.getUTCHours(); // Use UTC for consistency

  // Define trading sessions (UTC hours)
  const sessions = {
    // Asian session (Tokyo/Hong Kong) - 0-8 UTC
    asian: { start: 0, end: 8, liquidity: 'moderate' },
    // European session (London) - 8-16 UTC
    european: { start: 8, end: 16, liquidity: 'high' },
    // American session (New York) - 13-21 UTC
    american: { start: 13, end: 21, liquidity: 'high' },
    // Overlap periods (high liquidity)
    londonNY: { start: 13, end: 16, liquidity: 'very_high' },
    // Low liquidity periods
    lowLiquidity: { start: 21, end: 24, liquidity: 'low' },
  };

  // Determine current session and liquidity
  let tradingSession = 'unknown';
  let liquidityLevel = 'unknown';
  let signal: 'ACTIVE' | 'NEUTRAL' | 'INACTIVE' = 'NEUTRAL';

  // Check London-NY overlap (highest liquidity)
  if (
    currentHour >= sessions.londonNY.start &&
    currentHour < sessions.londonNY.end
  ) {
    tradingSession = 'london_ny_overlap';
    liquidityLevel = 'very_high';
    signal = 'ACTIVE';
  }
  // Check European session
  else if (
    currentHour >= sessions.european.start &&
    currentHour < sessions.european.end
  ) {
    tradingSession = 'european';
    liquidityLevel = 'high';
    signal = 'ACTIVE';
  }
  // Check American session
  else if (
    currentHour >= sessions.american.start &&
    currentHour < sessions.american.end
  ) {
    tradingSession = 'american';
    liquidityLevel = 'high';
    signal = 'ACTIVE';
  }
  // Check Asian session
  else if (
    currentHour >= sessions.asian.start &&
    currentHour < sessions.asian.end
  ) {
    tradingSession = 'asian';
    liquidityLevel = 'moderate';
    signal = 'NEUTRAL';
  }
  // Low liquidity period
  else if (
    currentHour >= sessions.lowLiquidity.start ||
    currentHour < sessions.asian.start
  ) {
    tradingSession = 'low_liquidity';
    liquidityLevel = 'low';
    signal = 'INACTIVE';
  }

  // Weekend check (Saturday and Sunday)
  const dayOfWeek = now.getUTCDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    // Sunday = 0, Saturday = 6
    tradingSession = 'weekend';
    liquidityLevel = 'very_low';
    signal = 'INACTIVE';
  }

  return {
    type: 'validation',
    module: 'marketHours',
    symbol,
    signal,
    meta: {
      currentHour,
      timezone: 'UTC',
      tradingSession,
      liquidityLevel,
      candlesUsed: 1, // Not applicable for time-based analysis
    },
  };
}
