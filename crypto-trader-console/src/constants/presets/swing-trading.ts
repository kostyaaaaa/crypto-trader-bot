import type { TCoinConfig } from '../../types';

export const swingTradingPreset: TCoinConfig = {
  symbol: 'SWING TRADING',
  isActive: true,
  isTrader: true,
  analysisConfig: {
    candleTimeframe: '4h',
    oiWindow: 40,
    liqWindow: 40,
    volWindow: 30,
    corrWindow: 15,
    higherMA: {
      timeframe: '1d',
      maShort: 10,
      maLong: 21,
      type: 'EMA',
      thresholdPct: 0.3,
      scale: 15,
      emaSeed: 'sma',
    },
    weights: {
      trend: 0.35,
      trendRegime: 0.25,
      liquidity: 0.15,
      openInterest: 0.16,
      higherMA: 0.05,
    },
    moduleThresholds: {
      trend: 25,
      trendRegime: 20,
      liquidity: 15,
      openInterest: 10,
      higherMA: 10,
    },
  },
  strategy: {
    entry: {
      minScore: { LONG: 55, SHORT: 55 },
      minModules: 5,
      requiredModules: ['trend', 'trendRegime'],
      maxSpreadPct: 0.04,
      cooldownMin: 60,
      lookback: 3,
      avoidWhen: { volatility: 'DEAD' },
      sideBiasTolerance: 8,
    },
    volatilityFilter: { minThreshold: 0.6, maxThreshold: 5.0 },
    capital: {
      account: 100,
      riskPerTradePct: 7,
      leverage: 3,
      maxConcurrentPositions: 1,
    },
    sizing: { maxAdds: 1, addOnAdverseMovePct: 0.7, addMultiplier: 1.3 },
    exits: {
      oppositeCountExit: 0,
      tp: { use: true, tpGridPct: [10, 20, 30], tpGridSizePct: [40, 30, 30] },
      sl: {
        type: 'hard',
        hardPct: 6,
        atrMult: 1.2,
        signalRules: {
          flipIf: { scoreGap: 25, minOppScore: 70 },
          moduleFail: { required: ['trend', 'trendRegime'] },
        },
      },
      time: { maxHoldMin: 10000, noPnLFallback: 'breakeven' },
      trailing: { use: true, startAfterPct: 3, trailStepPct: 1 },
    },
  },
};
