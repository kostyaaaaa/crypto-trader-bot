export const ANALYSIS_CONFIG = {
  ENAUSDT: {
    // --- Налаштування аналізу ---
    analysisConfig: {
      candleTimeframe: '5m',
      oiWindow: 10,
      liqWindow: 20,
      liqSentWindow: 5,
      fundingWindow: 80,
      volWindow: 14,
      corrWindow: 5,
      longShortWindow: 5,   // 🆕 беремо останні 5 точок з Binance L/S ratio

      weights: {
        trend: 0.25,
        trendRegime: 0.15,
        liquidity: 0.2,
        funding: 0.15,
        liquidations: 0.05,   // 🔽 зменшено
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

    // --- Налаштування торгової стратегії ---
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
        account: 200,
        riskPerTradePct: 0.5,
        leverage: 5,
        maxConcurrentPositions: 3,
      },
      sizing: {
        baseSizeUsd: 10,
        maxAdds: 2,
        addOnAdverseMovePct: 0.5,
        addMultiplier: 1.0,
        maxPositionUsd: 30,
      },
      exits: {
        tp: {
          use: true,
          tpGridPct: [3, 5],
          tpGridSizePct: [60, 40],
        },
        sl: {
          // 🔽 Можна перемикати
          type: 'hard',      // 'hard' або 'atr'
          hardPct: 1.2,     // використовується тільки коли type='hard'
          atrMult: 1.5,     // використовується тільки коли type='atr'
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

  HIFIUSDT: {
    // --- Налаштування аналізу ---
    analysisConfig: {
      candleTimeframe: '1m',
      oiWindow: 15,        // трохи коротше, щоб швидше реагувати
      liqWindow: 10,       // ліквідність більш чутлива
      liqSentWindow: 2,    // останні 2 хв ліквідацій
      fundingWindow: 20,   // funding на 20 хв
      volWindow: 14,       // стандартний ATR(14)
      corrWindow: 2,       // мінімальний вплив BTC на 1m
      longShortWindow: 2,  // швидше реагуємо на L/S зміни

      weights: {
        trend: 0.25,        // залишаємо вагу на тренд
        trendRegime: 0.1,   // ADX на 1m менш надійний
        liquidity: 0.25,    // ліквідність головна
        funding: 0.05,      // слабкий вплив
        liquidations: 0.1,  // хай буде більший вплив
        openInterest: 0.15, // важливий фактор
        correlation: 0.05,  // мінімальний вплив
        longShort: 0.05,    // L/S трохи враховуємо
      },

      moduleThresholds: {
        trend: 25,        // нижчий поріг на 1m
        trendRegime: 5,
        liquidity: 15,    // чутливіше
        funding: 5,       // дуже мʼяко
        liquidations: 15,
        openInterest: 10,
        correlation: 3,
        longShort: 3,
      },
    },

    // --- Налаштування торгової стратегії ---
    strategy: {
      entry: {
        minScore: { LONG: 35, SHORT: 35 }, // 🔽 нижчий поріг для входу
        minModules: 2,                     // 2 модулі достатньо
        requiredModules: [],               // не блокуємо по тренду
        maxSpreadPct: 0.08,                // дозволяємо трохи ширший спред
        cooldownMin: 1,                    // швидше перезаходимо
        avoidWhen: {
          volatility: 'DEAD',
          fundingExtreme: { absOver: 0.15 },
        },
        sideBiasTolerance: 0.5,              // нижча толерантність
      },
      volatilityFilter: {
        deadBelow: 0.1,
        extremeAbove: 4.0,
      },
      capital: {
        account: 200,
        riskPerTradePct: 0.5,
        leverage: 5,
        maxConcurrentPositions: 3,
      },
      sizing: {
        baseSizeUsd: 10,
        maxAdds: 2,                   // можна до 3 доливів
        addOnAdverseMovePct: 0.4,     // чутливіший долив
        addMultiplier: 1.1,           // трохи збільшуємо
        maxPositionUsd: 40,
      },
      exits: {
        tp: {
          use: true,
          tpGridPct: [0.8, 1.6],      // дрібніші кроки для скальпу
          tpGridSizePct: [50, 50],
        },
        sl: {
          type: 'atr',                // ✅ використовуємо ATR-стоп
          hardPct: 1.2,               // запаска
          atrMult: 1.2,               // SL = 1.2×ATR
          signalRules: {
            flipIf: { scoreGap: 10, minOppScore: 50 },
            moduleFail: { required: [] },
          },
        },
        time: {
          maxHoldMin: 30,             // максимум 30 хвилин тримаємо
          noPnLFallback: 'close',
        },
        trailing: {
          use: true,
          startAfterPct: 0.5,
          trailStepPct: 0.25,
        },
      },
    },
  },
  SOLUSDT: {
    // --- Налаштування аналізу ---
    analysisConfig: {
      candleTimeframe: '15m',
      oiWindow: 12,        // ~1h історії
      liqWindow: 20,
      liqSentWindow: 5,
      fundingWindow: 80,   // ~1h20 funding
      volWindow: 14,
      corrWindow: 5,
      longShortWindow: 5,

      weights: {
        trend: 0.25,
        trendRegime: 0.15,
        liquidity: 0.25,    // 🔼 SOL чутлива до стакану
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

    // --- Налаштування торгової стратегії ---
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
        deadBelow: 0.25,   // SOL більш волатильна
        extremeAbove: 3.0, // теж трохи вище
      },
      capital: {
        account: 200,
        riskPerTradePct: 0.5,
        leverage: 5,
        maxConcurrentPositions: 3,
      },
      sizing: {
        baseSizeUsd: 12,       // трохи більше за ENA
        maxAdds: 2,
        addOnAdverseMovePct: 0.5,
        addMultiplier: 1.0,
        maxPositionUsd: 36,
      },
      exits: {
        tp: {
          use: true,
          tpGridPct: [3, 5],
          tpGridSizePct: [60, 40],
        },
        sl: {
          // 🔽 Можна перемикати
          type: 'atr',      // 'hard' або 'atr'
          hardPct: 1.2,     // використовується тільки коли type='hard'
          atrMult: 1.5,     // використовується тільки коли type='atr'
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
};