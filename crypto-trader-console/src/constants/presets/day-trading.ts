import type { TCoinConfig } from '../../types';

export const dayTradingPreset: TCoinConfig = {
  symbol: 'DAY TRADING',
  isActive: true,
  isTrader: true,

  analysisConfig: {
    candleTimeframe: '15m',
    oiWindow: 3,
    liqWindow: 15,
    volWindow: 14,
    corrWindow: 8,
    higherMA: {
      timeframe: '4h',
      maShort: 7,
      maLong: 14,
      type: 'SMA',
      thresholdPct: 0.2,
      scale: 10,
      emaSeed: 'sma',
    },
    weights: {
      trend: 0.1,
      trendRegime: 0.23,
      liquidity: 0.16,
      openInterest: 0.2,
      higherMA: 0,
      rsiVolTrend: 0.28,
    },
    moduleThresholds: {
      trend: 50,
      trendRegime: 53,
      liquidity: 15,
      openInterest: 45,
      higherMA: 8,
      rsiVolTrend: 30,
    },
  },
  strategy: {
    entry: {
      minScore: { LONG: 48, SHORT: 48 },
      minModules: 3,
      requiredModules: ['trend'],
      maxSpreadPct: 0.05,
      cooldownMin: 10,
      avoidWhen: { volatility: 'DEAD' },
      sideBiasTolerance: 8,
      lookback: 3,
    },
    volatilityFilter: { minThreshold: 0.3, maxThreshold: 1.6 },
    capital: {
      account: 100,
      riskPerTradePct: 10,
      leverage: 8,
      maxConcurrentPositions: 1,
    },
    sizing: { maxAdds: 0, addOnAdverseMovePct: 0.5, addMultiplier: 1.2 },
    exits: {
      oppositeCountExit: 0,
      tp: { use: true, tpGridPct: [3.5, 7, 10], tpGridSizePct: [60, 25, 15] },
      sl: {
        type: 'hard',
        hardPct: 6,
        atrMult: 1.8,
        signalRules: {
          flipIf: { scoreGap: 20, minOppScore: 55 },
          moduleFail: { required: ['trend', 'trendRegime'] },
        },
      },
      time: { maxHoldMin: 360, noPnLFallback: 'breakeven' },
      trailing: { use: true, startAfterPct: 5.0, trailStepPct: 2 },
    },
  },
};
