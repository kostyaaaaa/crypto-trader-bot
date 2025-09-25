export const ANALYSIS_CONFIG = [
 {
    symbol: "ENAUSDT",
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
        minScore: { LONG: 44, SHORT: 44 },
        minModules: 3,
        requiredModules: ['trend'], // можна додати ['trend','trendRegime'] якщо хочеш жорсткіше
        maxSpreadPct: 0.05,
        cooldownMin: 3,
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
        leverage: 5,
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
          tpGridPct: [5],
          tpGridSizePct: [100],
        },
        sl: {
          // 🔽 Можна перемикати
          type: 'hard', // 'hard' або 'atr'
          hardPct: 5, // використовується тільки коли type='hard'
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
          startAfterPct: 0.8,
          trailStepPct: 0.3,
        },
      },
    },
  },

 {
    symbol: "SOLUSDT",
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
        minScore: { LONG: 46, SHORT: 46 }, // трохи вище за ENA
        minModules: 3,
        requiredModules: ['trend'], // можна додати 'trendRegime' якщо хочеш жорсткіше
        maxSpreadPct: 0.05,
        cooldownMin: 3,
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
        leverage: 5,
        maxConcurrentPositions: 3,
      },
      sizing: {
        maxAdds: 2,
        addOnAdverseMovePct: 0.5,
        addMultiplier: 0.5,
      },
      exits: {
        tp: {
          use: false,
          tpGridPct: [20],
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
          startAfterPct: 0.8,
          trailStepPct: 0.3,
        },
      },
    },
  },
 {
    symbol: "ETHUSDT",
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
          tpGridPct: [5, 10], // робимо сітку: перший TP на 5%, другий на 10%
          tpGridSizePct: [50, 50], // половину фіксуємо на TP1, половину на TP2
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
          startAfterPct: 1.5, // після +1.5% починаємо трейлити
          trailStepPct: 0.7, // підтягуємо на 0.7%
        },
      },
    },
  },
]
