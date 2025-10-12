import type { TCoinConfig } from '../../types';

export const scalpingPreset: TCoinConfig = {
  symbol: 'SCALPING',
  isActive: true,
  analysisConfig: {
    candleTimeframe: '1m',
    oiWindow: 10,
    liqWindow: 10,
    liqSentWindow: 5,
    volWindow: 14,
    corrWindow: 5,
    longShortWindow: 5,
    higherMA: {
      timeframe: '4h',
      maShort: 5,
      maLong: 10,
      type: 'EMA',
      thresholdPct: 0.1,
      scale: 8,
      emaSeed: 'first',
    },
    weights: {
      trend: 0.157,
      trendRegime: 0.05,
      liquidity: 0.176,
      liquidations: 0.157,
      openInterest: 0.44,

      longShort: 0.006,
      higherMA: 0.0,
      rsiVolTrend: 0,
    },
    moduleThresholds: {
      trend: 25,
      trendRegime: 12,
      liquidity: 5,
      liquidations: 5,
      openInterest: 10,

      longShort: 15,
      higherMA: 5,
      rsiVolTrend: 0,
    },
  },
  strategy: {
    entry: {
      minScore: { LONG: 43, SHORT: 43 },
      minModules: 2,
      requiredModules: ['liquidity', 'openInterest'],
      maxSpreadPct: 0.02,
      cooldownMin: 2,
      lookback: 3,
      avoidWhen: { volatility: 'DEAD' },
      sideBiasTolerance: 2,
    },
    volatilityFilter: { minThreshold: 0.08, maxThreshold: 3.5 },
    liquidationsFilter: { minThreshold: 5000, maxThreshold: 500000 },
    capital: {
      account: 100,
      riskPerTradePct: 5,
      leverage: 10,
      maxConcurrentPositions: 1,
    },
    sizing: { maxAdds: 0, addOnAdverseMovePct: 0.3, addMultiplier: 1 },
    exits: {
      oppositeCountExit: 0,
      tp: { use: true, tpGridPct: [2], tpGridSizePct: [100] },
      sl: {
        type: 'hard',
        hardPct: 3,
        atrMult: 0.5,
        signalRules: {
          flipIf: { scoreGap: 20, minOppScore: 65 },
          moduleFail: { required: ['liquidity'] },
        },
      },
      time: { maxHoldMin: 5, noPnLFallback: 'closeSmallLoss' },
      trailing: { use: false, startAfterPct: 0, trailStepPct: 0 },
    },
  },
};
