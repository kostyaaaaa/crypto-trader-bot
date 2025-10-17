import axios from 'axios';

export interface IExchangeHealthModule {
  type: 'validation';
  module: 'exchangeHealth';
  symbol: string;
  signal: 'ACTIVE' | 'NEUTRAL' | 'INACTIVE';
  meta: {
    exchangeStatus: string;
    apiLatency: number;
    hasIssues: boolean;
    lastCheck: string;
    candlesUsed: number;
  };
}

export async function analyzeExchangeHealth(
  symbol: string = 'ETHUSDT',
): Promise<IExchangeHealthModule | null> {
  const startTime = Date.now();

  try {
    // Test Binance API health with a simple request
    const healthCheck = await checkBinanceHealth();
    const apiLatency = Date.now() - startTime;

    let signal: 'ACTIVE' | 'NEUTRAL' | 'INACTIVE' = 'ACTIVE';
    let exchangeStatus = 'healthy';
    let hasIssues = false;

    // Determine signal based on API response and latency
    if (!healthCheck.isHealthy) {
      signal = 'INACTIVE';
      exchangeStatus = 'unhealthy';
      hasIssues = true;
    } else if (apiLatency > 5000) {
      // More than 5 seconds
      signal = 'INACTIVE';
      exchangeStatus = 'slow';
      hasIssues = true;
    } else if (apiLatency > 2000) {
      // More than 2 seconds
      signal = 'NEUTRAL';
      exchangeStatus = 'degraded';
      hasIssues = true;
    } else {
      signal = 'ACTIVE';
      exchangeStatus = 'healthy';
      hasIssues = false;
    }

    return {
      type: 'validation',
      module: 'exchangeHealth',
      symbol,
      signal,
      meta: {
        exchangeStatus,
        apiLatency,
        hasIssues,
        lastCheck: new Date().toISOString(),
        candlesUsed: 1, // Not applicable for health check
      },
    };
  } catch (error) {
    // If we can't even make the request, exchange is down
    return {
      type: 'validation',
      module: 'exchangeHealth',
      symbol,
      signal: 'INACTIVE',
      meta: {
        exchangeStatus: 'down',
        apiLatency: Date.now() - startTime,
        hasIssues: true,
        lastCheck: new Date().toISOString(),
        candlesUsed: 1,
      },
    };
  }
}

async function checkBinanceHealth(): Promise<{
  isHealthy: boolean;
  details: any;
}> {
  try {
    // Test multiple Binance endpoints to check health
    const [serverTime, exchangeInfo, ticker] = await Promise.allSettled([
      // Server time endpoint (lightweight)
      axios.get('https://fapi.binance.com/fapi/v1/time', { timeout: 5000 }),
      // Exchange info (moderate)
      axios.get('https://fapi.binance.com/fapi/v1/exchangeInfo', {
        timeout: 10000,
      }),
      // Ticker for our symbol (moderate)
      axios.get('https://fapi.binance.com/fapi/v1/ticker/24hr', {
        params: { symbol: 'ETHUSDT' },
        timeout: 10000,
      }),
    ]);

    const results = {
      serverTime: serverTime.status === 'fulfilled',
      exchangeInfo: exchangeInfo.status === 'fulfilled',
      ticker: ticker.status === 'fulfilled',
    };

    // Consider healthy if at least 2 out of 3 endpoints work
    const healthyCount = Object.values(results).filter(Boolean).length;
    const isHealthy = healthyCount >= 2;

    return {
      isHealthy,
      details: {
        ...results,
        healthyEndpoints: healthyCount,
        totalEndpoints: 3,
      },
    };
  } catch (error) {
    return {
      isHealthy: false,
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}
