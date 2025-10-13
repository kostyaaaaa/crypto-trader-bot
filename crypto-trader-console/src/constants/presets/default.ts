import type { TCoinConfig } from '../../types';

export const defaultPreset: TCoinConfig = {
  symbol: 'DEFAULT',
  isActive: true,
  analysisConfig: {
    candleTimeframe: '15m',
    oiWindow: 20,
    liqWindow: 30,
    volWindow: 14,
    corrWindow: 10,
    longShortWindow: 10,
    higherMA: {
      timeframe: '1d',
      maShort: 7,
      maLong: 14,
      type: 'SMA',
      thresholdPct: 0.2,
      scale: 12,
      emaSeed: 'sma',
    },
    weights: {
      trend: 0.3,
      trendRegime: 0.15,
      liquidity: 0.2,
      openInterest: 0.15,
      longShort: 0.02,
      higherMA: 0.08,
      rsiVolTrend: 0.1,
    },
    moduleThresholds: {
      trend: 50,
      trendRegime: 7,
      liquidity: 40,
      openInterest: 25,
      longShort: 12,
      higherMA: 7,
      rsiVolTrend: 0,
    },
  },
  strategy: {
    entry: {
      minScore: {
        LONG: 55,
        SHORT: 55,
      },
      minModules: 3,
      requiredModules: ['trend', 'trendRegime'],
      maxSpreadPct: 0.05,
      cooldownMin: 5,
      lookback: 3,
      avoidWhen: {
        volatility: 'DEAD',
      },
      sideBiasTolerance: 5,
    },
    volatilityFilter: {
      minThreshold: 0.25,
      maxThreshold: 2.5,
    },
    liquidationsFilter: {
      minThreshold: 10000,
      maxThreshold: 1000000,
    },
    capital: {
      account: 100,
      riskPerTradePct: 10,
      leverage: 3,
      maxConcurrentPositions: 2,
    },
    sizing: {
      maxAdds: 1,
      addOnAdverseMovePct: 1,
      addMultiplier: 1.0,
    },
    exits: {
      oppositeCountExit: 0,
      tp: {
        use: true,
        tpGridPct: [5, 10],
        tpGridSizePct: [50, 50],
      },
      sl: {
        type: 'atr',
        hardPct: 5,
        atrMult: 1.8,
        signalRules: {
          flipIf: {
            scoreGap: 12,
            minOppScore: 60,
          },
          moduleFail: {
            required: ['trend'],
          },
        },
      },
      time: {
        maxHoldMin: 240,
        noPnLFallback: 'none',
      },
      trailing: {
        use: true,
        startAfterPct: 1.5,
        trailStepPct: 0.7,
      },
    },
  },
};
