export const ANALYSIS_CONFIG = [
  {
    symbol: 'ENAUSDT',
    isActive: true,
    analysisConfig: {
      candleTimeframe: '5m',
      oiWindow: 10,
      liqWindow: 20,
      liqSentWindow: 5,
      fundingWindow: 80,
      volWindow: 14,
      corrWindow: 5,
      longShortWindow: 5, // 🆕 беремо останні 5 точок з Binance L/S ratio

      weights: {
        trend: 0.25,
        trendRegime: 0.15,
        liquidity: 0.2,
        funding: 0.15,
        liquidations: 0.05, // 🔽 зменшено
        openInterest: 0.1,
        correlation: 0.05,
        longShort: 0.05,
      },
      moduleThresholds: {
        trend: 40,
        trendRegime: 5,
        liquidity: 30,
        funding: 15,
        liquidations: 30,
        openInterest: 20,
        correlation: 10,
        longShort: 10,
      },
    },
    strategy: {
      entry: {
        minScore: { LONG: 46, SHORT: 46 },
        minModules: 3,
        requiredModules: ['trend'], // можна додати ['trend','trendRegime'] якщо хочеш жорсткіше
        maxSpreadPct: 0.05,
        cooldownMin: 10,
        avoidWhen: {
          volatility: 'DEAD',
          fundingExtreme: { absOver: 0.12 },
        },
        sideBiasTolerance: 5,
      },
      volatilityFilter: {
        deadBelow: 0.2,
        extremeAbove: 2.5,
      },
      capital: {
        account: 100,
        riskPerTradePct: 10,
        leverage: 10,
        maxConcurrentPositions: 3,
      },
      sizing: {
        maxAdds: 2,
        addOnAdverseMovePct: 0.5,
        addMultiplier: 0.5,
      },
      exits: {
        tp: {
          use: true,
          tpGridPct: [12],
          tpGridSizePct: [100],
        },
        sl: {
          // 🔽 Можна перемикати
          type: 'hard', // 'hard' або 'atr'
          hardPct: 7, // використовується тільки коли type='hard'
          atrMult: 1.5, // використовується тільки коли type='atr'
          signalRules: {
            flipIf: { scoreGap: 10, minOppScore: 55 },
            moduleFail: { required: ['trend'] },
          },
        },
        time: {
          maxHoldMin: 0,
          noPnLFallback: 'none',
        },
        trailing: {
          use: true,
          startAfterPct: 0.2,
          trailStepPct: 0.1,
        },
      },
    },
  },

  {
    symbol: 'SOLUSDT',
    isActive: true,
    analysisConfig: {
      candleTimeframe: '15m',
      oiWindow: 12, // ~1h історії
      liqWindow: 20,
      liqSentWindow: 5,
      fundingWindow: 80, // ~1h20 funding
      volWindow: 14,
      corrWindow: 5,
      longShortWindow: 5,

      weights: {
        trend: 0.25,
        trendRegime: 0.15,
        liquidity: 0.25, // 🔼 SOL чутлива до стакану
        funding: 0.1,
        liquidations: 0.05,
        openInterest: 0.15, // 🔼 більше значення для OI
        correlation: 0.03,
        longShort: 0.02,
      },
      moduleThresholds: {
        trend: 40,
        trendRegime: 5,
        liquidity: 30,
        funding: 15,
        liquidations: 30,
        openInterest: 20,
        correlation: 10,
        longShort: 10,
      },
    },
    strategy: {
      entry: {
        minScore: { LONG: 47, SHORT: 47 }, // трохи вище за ENA
        minModules: 3,
        requiredModules: ['trend'], // можна додати 'trendRegime' якщо хочеш жорсткіше
        maxSpreadPct: 0.05,
        cooldownMin: 10,
        avoidWhen: {
          volatility: 'DEAD',
          fundingExtreme: { absOver: 0.15 }, // SOL трохи ширший діапазон
        },
        sideBiasTolerance: 5,
      },
      volatilityFilter: {
        deadBelow: 0.25, // SOL більш волатильна
        extremeAbove: 3.0, // теж трохи вище
      },
      capital: {
        account: 100,
        riskPerTradePct: 10,
        leverage: 10,
        maxConcurrentPositions: 3,
      },
      sizing: {
        maxAdds: 2,
        addOnAdverseMovePct: 0.5,
        addMultiplier: 0.5,
      },
      exits: {
        tp: {
          use: true,
          tpGridPct: [12],
          tpGridSizePct: [100],
        },
        sl: {
          // 🔽 Можна перемикати
          type: 'hard', // 'hard' або 'atr'
          hardPct: 10, // використовується тільки коли type='hard'
          atrMult: 1.5, // використовується тільки коли type='atr'
          signalRules: {
            flipIf: { scoreGap: 10, minOppScore: 55 },
            moduleFail: { required: ['trend'] },
          },
        },
        time: {
          maxHoldMin: 0,
          noPnLFallback: 'none',
        },
        trailing: {
          use: true,
          startAfterPct: 0.2,
          trailStepPct: 0.1,
        },
      },
    },
  },
  {
    symbol: 'ETHUSDT',
    isActive: true,
    analysisConfig: {
      candleTimeframe: '15m', // працюємо на 15 хвилинних свічках
      oiWindow: 20, // більше даних OI (~5 годин)
      liqWindow: 30, // ліквідність ширша
      liqSentWindow: 5,
      fundingWindow: 96, // майже доба funding
      volWindow: 14, // стандартний ATR(14)
      corrWindow: 10, // враховуємо BTC кореляцію
      longShortWindow: 10, // L/S ratio більш стабільний

      weights: {
        trend: 0.3, // тренд — ключовий для ETH
        trendRegime: 0.15,
        liquidity: 0.2, // стакан важливий, але не головний
        funding: 0.1,
        liquidations: 0.05,
        openInterest: 0.15,
        correlation: 0.03, // кореляція з BTC, але невелика
        longShort: 0.02,
      },

      moduleThresholds: {
        trend: 50, // тренд беремо сильніший
        trendRegime: 7,
        liquidity: 40,
        funding: 20,
        liquidations: 30,
        openInterest: 25,
        correlation: 12,
        longShort: 12,
      },
    },
    strategy: {
      entry: {
        minScore: { LONG: 55, SHORT: 55 }, // більш строгий поріг
        minModules: 3,
        requiredModules: ['trend', 'trendRegime'], // для надійності
        maxSpreadPct: 0.05,
        cooldownMin: 5, // рідше заходимо
        avoidWhen: {
          volatility: 'DEAD',
          fundingExtreme: { absOver: 0.1 }, // funding до ±0.1 ок
        },
        sideBiasTolerance: 5,
      },
      volatilityFilter: {
        deadBelow: 0.25, // для ETH мертва волатильність нижча
        extremeAbove: 2.5,
      },
      capital: {
        account: 100,
        riskPerTradePct: 10, // ризик 10% від акаунту
        leverage: 3, // помірне плече для ETH
        maxConcurrentPositions: 2,
      },
      sizing: {
        maxAdds: 1, // максимум один долив
        addOnAdverseMovePct: 1, // додаємо тільки якщо пішло проти на 1%
        addMultiplier: 0.5,
      },
      exits: {
        tp: {
          use: true,
          tpGridPct: [6], // робимо сітку: перший TP на 5%, другий на 10%
          tpGridSizePct: [100], // половину фіксуємо на TP1, половину на TP2
        },
        sl: {
          type: 'atr', // краще SL по ATR на ефірі
          hardPct: 5, // fallback — 5% від угоди
          atrMult: 1.8, // ATR ×1.8 дає простір
          signalRules: {
            flipIf: { scoreGap: 12, minOppScore: 60 },
            moduleFail: { required: ['trend'] },
          },
        },
        time: {
          maxHoldMin: 0, // максимум 4 години на угоду
          noPnLFallback: 'close',
        },
        trailing: {
          use: true,
          startAfterPct: 0.2,
          trailStepPct: 0.1,
        },
      },
    },
  },
  {
    symbol: 'BNBUSDT', // торгуємо BNB perpetual / ф’ючерс
    isActive: true,
    analysisConfig: {
      candleTimeframe: '5m',
      oiWindow: 20,
      liqWindow: 30,
      liqSentWindow: 10,
      fundingWindow: 100,
      volWindow: 14,
      corrWindow: 5,
      longShortWindow: 5,

      weights: {
        trend: 0.25,
        trendRegime: 0.15,
        liquidity: 0.2,
        funding: 0.15,
        liquidations: 0.05,
        openInterest: 0.1,
        correlation: 0.05,
        longShort: 0.05,
      },
      moduleThresholds: {
        trend: 40,
        trendRegime: 5,
        liquidity: 30,
        funding: 15,
        liquidations: 30,
        openInterest: 20,
        correlation: 10,
        longShort: 10,
      },
    },
    strategy: {
      entry: {
        minScore: { LONG: 46, SHORT: 46 },
        minModules: 3,
        requiredModules: ['trend'],
        maxSpreadPct: 0.07, // BNB може мати трохи більший спред
        cooldownMin: 3,
        avoidWhen: {
          volatility: 'DEAD',
          fundingExtreme: { absOver: 0.15 },
        },
        sideBiasTolerance: 5,
      },
      volatilityFilter: {
        deadBelow: 0.25,
        extremeAbove: 3.0,
      },
      capital: {
        account: 100,
        riskPerTradePct: 8, // зменшуємо ризик для волатильного BNB
        leverage: 10,
        maxConcurrentPositions: 2,
      },
      sizing: {
        maxAdds: 2,
        addOnAdverseMovePct: 0.5,
        addMultiplier: 0.5,
      },
      exits: {
        tp: {
          use: true,
          tpGridPct: [10], // два тейки: перший “забрати частину”, другий — закрити
          tpGridSizePct: [100], // 50% / 50%
        },
        sl: {
          type: 'hard',
          hardPct: 8,
          atrMult: 1.5,
          signalRules: {
            flipIf: { scoreGap: 10, minOppScore: 55 },
            moduleFail: { required: ['trend'] },
          },
        },
        time: {
          maxHoldMin: 0,
          noPnLFallback: 'none',
        },
        trailing: {
          use: true,
          startAfterPct: 0.2,
          trailStepPct: 0.1,
        },
      },
    },
  },
  {
    symbol: 'BTCUSDT',
    isActive: true,
    analysisConfig: {
      candleTimeframe: '1h',
      oiWindow: 48, // 2 days of 1h candles
      liqWindow: 30,
      liqSentWindow: 6,
      fundingWindow: 72, // funding signal over a longer horizon
      volWindow: 14, // ATR(14) on 1h
      corrWindow: 10, // (kept for consistency; low weight for BTC itself)
      longShortWindow: 12,

      weights: {
        trend: 0.3,
        trendRegime: 0.2,
        liquidity: 0.15,
        funding: 0.1,
        liquidations: 0.05,
        openInterest: 0.15,
        correlation: 0.02,
        longShort: 0.03,
      },
      moduleThresholds: {
        trend: 55,
        trendRegime: 10, // higher ADX threshold on 1h
        liquidity: 35,
        funding: 20,
        liquidations: 30,
        openInterest: 30,
        correlation: 12,
        longShort: 12,
      },
    },
    strategy: {
      entry: {
        minScore: { LONG: 58, SHORT: 58 },
        minModules: 4,
        requiredModules: ['trend', 'trendRegime', 'openInterest'],
        maxSpreadPct: 0.02, // BTC has tight spreads
        cooldownMin: 30, // fewer entries on 1h
        avoidWhen: {
          volatility: 'DEAD',
          fundingExtreme: { absOver: 0.15 },
        },
        sideBiasTolerance: 6,
      },
      volatilityFilter: {
        deadBelow: 0.15,
        extremeAbove: 2.0,
      },

      capital: {
        account: 100,
        riskPerTradePct: 6, // lower risk per trade on BTC
        leverage: 3,
        maxConcurrentPositions: 1,
      },
      sizing: {
        maxAdds: 1,
        addOnAdverseMovePct: 0.8, // add only if price moves 0.8% against
        addMultiplier: 0.5,
      },
      exits: {
        tp: {
          use: true,
          tpGridPct: [2, 4, 6], // conservative targets on 1h BTC
          tpGridSizePct: [40, 30, 30],
        },
        sl: {
          type: 'atr', // ATR-based stops for trend swings
          hardPct: 3, // fallback hard stop if ATR missing
          atrMult: 2.2,
          signalRules: {
            flipIf: { scoreGap: 12, minOppScore: 60 },
            moduleFail: { required: ['trend'] },
          },
        },
        time: {
          maxHoldMin: 480, // up to 8 hours
          noPnLFallback: 'close',
        },
        trailing: {
          use: true,
          startAfterPct: 0.2,
          trailStepPct: 0.1,
        },
      },
    },
  },
];
