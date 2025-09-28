export type TCoinConfig = {
  symbol: string;
  isActive: boolean;
  analysisConfig: {
    candleTimeframe: string;
    oiWindow: number;
    liqWindow: number;
    liqSentWindow: number;
    fundingWindow: number;
    volWindow: number;
    corrWindow: number;
    longShortWindow: number;
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
      avoidWhen: {
        volatility: string;
        fundingExtreme: {
          absOver: number;
        };
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
      maxPositionUsd: number;
      maxAdds: number;
      addOnAdverseMovePct: number;
      addMultiplier: number;
      baseSizeUsd: number;
    };
    exits: {
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
  funding: number;
  liquidations: number;
  openInterest: number;
  correlation: number;
  longShort: number;
};

export type TCoinConfigResponse = TCoinConfig & {
  createdAt?: string;
  updatedAt?: string;
  _id: string;
};
