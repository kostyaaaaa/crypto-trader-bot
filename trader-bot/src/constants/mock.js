export const ANALYSIS_CONFIG = {
  ENAUSDT: {
    // --- Налаштування аналізу ---
    analysisConfig: {
      candleTimeframe: '5m',
      oiWindow: 10, // 10 * 5m = ~50 хв історії
      liqWindow: 20, // 20 хв ліквідності (можна залишити)
      liqSentWindow: 5, // 5 хв ліквідацій
      fundingWindow: 80, // ~1h20 усереднення funding
      volWindow: 14, // ATR(14) → ~70 хв історії
      corrWindow: 5, // 5 хв для кореляції з BTC

      // --- Ваги модулів у підсумковому скорі ---
      weights: {
        trend: 0.3, // тренд на 5m сильніше
        liquidity: 0.2,
        funding: 0.15,
        liquidations: 0.15,
        openInterest: 0.15,
        correlation: 0.05, // менш важлива на довших ТФ
      },
      moduleThresholds: {
        trend: 40,
        liquidity: 30,
        funding: 20,
        liquidations: 40,
        openInterest: 20,
        correlation: 10,
      },
    },

    // --- Налаштування торгової стратегії ---
    strategy: {
      entry: {
        minScore: { LONG: 44, SHORT: 44 }, // мінімальний сумарний скор для входу
        minModules: 3, // скільки модулів мають співпасти
        requiredModules: ['trend'], // обов'fязкові модулі (наприклад тренд)
        maxSpreadPct: 0.05, // фільтр: не входимо якщо спред >0.05%
        cooldownMin: 3, // антиспам: мінімальний час між входами
        avoidWhen: {
          // умови НЕ входити
          volatility: 'DEAD', // якщо волатильність низька → не торгуємо
          fundingExtreme: { absOver: 0.12 }, // якщо funding занадто високий/низький
        },
        sideBiasTolerance: 5, // мін. різниця між LONG/SHORT скором
      },
      volatilityFilter: {
        deadBelow: 0.2, // ATR% < 0.2 → ринок "мертвий"
        extremeAbove: 2.5, // ATR% > 2.5 → ринок "екстремальний"
      },
      capital: {
        account: 200, // розмір усього акаунту (USD)
        riskPerTradePct: 0.5, // % ризику на одну угоду
        leverage: 5, // кредитне плече
        maxConcurrentPositions: 3, // максимальна кількість відкритих угод
      },

      sizing: {
        baseSizeUsd: 10, // базовий розмір входу
        maxAdds: 2, // скільки разів можна доливати
        addOnAdverseMovePct: 0.5, // доливка кожні -0.5% проти нас
        addMultiplier: 1.0, // множник (1.0 = рівномірно, >1 = піраміда)
        maxPositionUsd: 30, // максимально допустимий розмір усієї позиції
      },

      exits: {
        tp: {
          use: true, // чи використовуємо тейки
          tpGridPct: [3, 5], // рівні тейків (% від входу)
          tpGridSizePct: [60, 40], // частки позиції для фіксації
        },
        sl: {
          type: 'hard', // "signal" або "hard"
          hardPct: 1.2, // жорсткий стоп у % (якщо type=hard)
          signalRules: {
            flipIf: { scoreGap: 10, minOppScore: 55 }, // flip у протилежний сигнал
            moduleFail: { required: ['trend'] }, // стоп, якщо тренд розвернувся
          },
        },
        time: {
          maxHoldMin: 0, // часовий стоп (0 = вимкнено)
          noPnLFallback: 'none', // fallback: "none" | "breakeven" | "closeSmallLoss"
        },
        trailing: {
          use: true, // чи використовуємо трейлінг
          startAfterPct: 0.8, // коли активувати трейлінг (% профіту)
          trailStepPct: 0.3, // відкат на 0.3% від піку → закриваємось
        },
      },
    },
  },
  HIFIUSDT: {
    // --- Налаштування аналізу ---
    analysisConfig: {
      candleTimeframe: '1m',
      oiWindow: 30, // 30 хв історії OI (шумно менше)
      liqWindow: 20, // 20 хв ліквідності
      liqSentWindow: 3, // останні 3 хв ліквідацій (швидко реагує)
      fundingWindow: 60, // 1 година усереднення funding
      volWindow: 21, // ATR(21) → 21 хв історії
      corrWindow: 3,

      // --- Ваги модулів у підсумковому скорі ---
      weights: {
        trend: 0.2,
        liquidity: 0.25, // ліквідність важливіша на хвилинках
        funding: 0.1,
        liquidations: 0.2,
        openInterest: 0.15,
        correlation: 0.1,
      },

      // --- Мінімальна сила сигналів від кожного модуля (0–100) ---
      moduleThresholds: {
        trend: 30, // швидкі свічки дають менший поріг
        liquidity: 25,
        funding: 15,
        liquidations: 30,
        openInterest: 15,
        correlation: 10,
      },
    },

    // --- Налаштування торгової стратегії ---
    strategy: {
      entry: {
        minScore: { LONG: 44, SHORT: 44 }, // мінімальний сумарний скор для входу
        minModules: 3, // скільки модулів мають співпасти
        requiredModules: ['trend'], // обов'язкові модулі (наприклад тренд)
        maxSpreadPct: 0.05, // фільтр: не входимо якщо спред >0.05%
        cooldownMin: 3, // антиспам: мінімальний час між входами
        avoidWhen: {
          // умови НЕ входити
          volatility: 'DEAD', // якщо волатильність низька → не торгуємо
          fundingExtreme: { absOver: 0.12 }, // якщо funding занадто високий/низький
        },
        sideBiasTolerance: 5, // мін. різниця між LONG/SHORT скором
      },
      volatilityFilter: {
        deadBelow: 0.2, // ATR% < 0.2 → ринок "мертвий"
        extremeAbove: 2.5, // ATR% > 2.5 → ринок "екстремальний"
      },
      capital: {
        account: 200, // розмір усього акаунту (USD)
        riskPerTradePct: 0.5, // % ризику на одну угоду
        leverage: 5, // кредитне плече
        maxConcurrentPositions: 3, // максимальна кількість відкритих угод
      },

      sizing: {
        baseSizeUsd: 10, // базовий розмір входу
        maxAdds: 2, // скільки разів можна доливати
        addOnAdverseMovePct: 0.5, // доливка кожні -0.5% проти нас
        addMultiplier: 1.0, // множник (1.0 = рівномірно, >1 = піраміда)
        maxPositionUsd: 30, // максимально допустимий розмір усієї позиції
      },

      exits: {
        tp: {
          use: true, // чи використовуємо тейки
          tpGridPct: [0.8, 1.5], // рівні тейків (% від входу)
          tpGridSizePct: [60, 40], // частки позиції для фіксації
        },
        sl: {
          type: 'hard', // "signal" або "hard"
          hardPct: 1.2, // жорсткий стоп у % (якщо type=hard)
          signalRules: {
            flipIf: { scoreGap: 10, minOppScore: 55 }, // flip у протилежний сигнал
            moduleFail: { required: ['trend'] }, // стоп, якщо тренд розвернувся
          },
        },
        time: {
          maxHoldMin: 0, // часовий стоп (0 = вимкнено)
          noPnLFallback: 'none', // fallback: "none" | "breakeven" | "closeSmallLoss"
        },
        trailing: {
          use: true, // чи використовуємо трейлінг
          startAfterPct: 0.8, // коли активувати трейлінг (% профіту)
          trailStepPct: 0.3, // відкат на 0.3% від піку → закриваємось
        },
      },
    },
  },
};
