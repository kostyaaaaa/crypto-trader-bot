export type THigherMAConfig = {
  timeframe: string; // e.g. '1d', '4h'
  maShort: number; // e.g. 7
  maLong: number; // e.g. 14
  type: 'SMA' | 'EMA'; // moving average type
  thresholdPct: number; // noise threshold in percent
  scale: number; // linear scale for strength (strength = min(100, |deltaPct| * scale))
  emaSeed: 'sma' | 'first'; // EMA seed method
};

export type TCoinConfig = {
  symbol: string;
  isActive: boolean;
  analysisConfig: {
    candleTimeframe: string;
    oiWindow: number;
    liqWindow: number;
    liqSentWindow: number;
    volWindow: number;
    corrWindow: number;
    longShortWindow: number;
    higherMA: THigherMAConfig;
    weights: TAnalysisModule;
    moduleThresholds: TAnalysisModule;
  };
  strategy: {
    entry: {
      minScore: {
        LONG: number;
        SHORT: number;
      };
      minModules: number;
      requiredModules: string[];
      maxSpreadPct: number;
      cooldownMin: number;
      lookback: number;
      avoidWhen: {
        volatility: string;
      };
      sideBiasTolerance: number;
    };
    volatilityFilter: {
      deadBelow: number;
      extremeAbove: number;
    };
    capital: {
      account: number;
      riskPerTradePct: number;
      leverage: number;
      maxConcurrentPositions: number;
    };
    sizing: {
      maxAdds: number;
      addOnAdverseMovePct: number;
      addMultiplier: number;
    };
    exits: {
      oppositeCountExit?: number;

      tp: {
        use: boolean;
        tpGridPct: number[];
        tpGridSizePct: number[];
      };
      sl: {
        type: 'atr' | 'hard';
        hardPct: number;
        atrMult: number;
        signalRules: {
          flipIf: {
            scoreGap: number;
            minOppScore: number;
          };
          moduleFail: {
            required: string[];
          };
        };
      };
      time: {
        maxHoldMin: number;
        noPnLFallback: 'none' | 'breakeven' | 'closeSmallLoss';
      };
      trailing: {
        use: boolean;
        startAfterPct: number;
        trailStepPct: number;
      };
    };
  };
};

type TAnalysisModule = {
  trend: number;
  trendRegime: number;
  liquidity: number;
  liquidations: number;
  openInterest: number;
  longShort: number;
  higherMA: number;
  rsiVolTrend: number;
};

export type TCoinConfigResponse = TCoinConfig & {
  createdAt?: string;
  updatedAt?: string;
  _id: string;
};
