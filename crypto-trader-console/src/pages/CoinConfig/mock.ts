import type { TCoinConfig } from '../../types';

export const mockCreateConfigData: TCoinConfig = {
  symbol: 'ENAUSDT',
  isActive: true,
  analysisConfig: {
    candleTimeframe: '15m',
    oiWindow: 20,
    liqWindow: 30,
    liqSentWindow: 5,
    fundingWindow: 96,
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
      funding: 0.1,
      liquidations: 0.05,
      openInterest: 0.15,
      correlation: 0.03,
      longShort: 0.02,
      higherMA: 0.08,
    },
    moduleThresholds: {
      trend: 50,
      trendRegime: 7,
      liquidity: 40,
      funding: 20,
      liquidations: 30,
      openInterest: 25,
      correlation: 12,
      longShort: 12,
      higherMA: 7,
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
      avoidWhen: {
        volatility: 'DEAD',
        fundingExtreme: {
          absOver: 0.1,
        },
      },
      sideBiasTolerance: 5,
    },
    volatilityFilter: {
      deadBelow: 0.25,
      extremeAbove: 2.5,
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
