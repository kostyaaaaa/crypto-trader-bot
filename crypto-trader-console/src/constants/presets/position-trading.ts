import type { TCoinConfig } from '../../types';

export const positionTradingPreset: TCoinConfig = {
  symbol: 'POSITION TRADING',
  isActive: true,
  analysisConfig: {
    candleTimeframe: '1d',
    oiWindow: 90,
    liqWindow: 90,
    liqSentWindow: 30,
    fundingWindow: 168,
    volWindow: 60,
    corrWindow: 30,
    longShortWindow: 30,
    higherMA: {
      timeframe: '1w',
      maShort: 14,
      maLong: 28,
      type: 'EMA',
      thresholdPct: 0.5,
      scale: 20,
      emaSeed: 'sma',
    },
    weights: {
      trend: 0.4,
      trendRegime: 0.25,
      liquidity: 0.1,
      funding: 0.05,
      liquidations: 0.02,
      openInterest: 0.02,
      correlation: 0.01,
      longShort: 0.0,
      higherMA: 0.15,
      rsiVolTrend: 0,
    },
    moduleThresholds: {
      trend: 30,
      trendRegime: 20,
      liquidity: 15,
      funding: 10,
      liquidations: 10,
      openInterest: 10,
      correlation: 8,
      longShort: 8,
      higherMA: 15,
      rsiVolTrend: 0,
    },
  },
  strategy: {
    entry: {
      minScore: { LONG: 65, SHORT: 65 },
      minModules: 5,
      requiredModules: ['trend', 'trendRegime'],
      maxSpreadPct: 0.05,
      cooldownMin: 1440,
      lookback: 3,
      avoidWhen: { volatility: 'DEAD', fundingExtreme: { absOver: 0.0008 } },
      sideBiasTolerance: 10,
    },
    volatilityFilter: { deadBelow: 0.8, extremeAbove: 6.0 },
    capital: {
      account: 100,
      riskPerTradePct: 5,
      leverage: 1,
      maxConcurrentPositions: 1,
    },
    sizing: { maxAdds: 0, addOnAdverseMovePct: 0, addMultiplier: 1 },
    exits: {
      oppositeCountExit: 0,
      tp: { use: true, tpGridPct: [15, 35, 70], tpGridSizePct: [40, 35, 25] },
      sl: {
        type: 'atr', // ATR-based stop for position entries
        hardPct: 15, // fallback if ATR data is unavailable
        atrMult: 2.2, // slightly wider for higher timeframe noise
        signalRules: {
          flipIf: { scoreGap: 30, minOppScore: 75 },
          moduleFail: { required: ['trend', 'trendRegime'] },
        },
      },
      time: { maxHoldMin: 43200, noPnLFallback: 'none' },
      trailing: { use: false, startAfterPct: 0, trailStepPct: 0 },
    },
  },
};
