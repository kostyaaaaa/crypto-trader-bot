export const ANALYSIS_CONFIG = {
  ENAUSDT: {
    // --- Налаштування аналізу ---
    analysisConfig: {
      candleTimeframe: '1m',
      oiWindow: 10, // кількість 5m-свічок для Open Interest (~50 хв)
      liqWindow: 20, // кількість хвилин для аналізу ліквідності
      liqSentWindow: 5, // хвилин для ліквідацій
      fundingWindow: 80, // хвилин усереднення funding rate
      volWindow: 14, // період ATR (волатильність)
      corrWindow: 5, // хвилин для перевірки кореляції з BTC

      // --- Ваги модулів у підсумковому скорі ---
      weights: {
        trend: 0.25, // тренд найбільш ваажливий
        liquidity: 0.2,
        funding: 0.15,
        liquidations: 0.15,
        openInterest: 0.15,
        correlation: 0.1,
      },

      // --- Мінімальна сила сигналів від кожного модуля (0–100) ---
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
          tpGridPct: [0.4, 0.8, 1.2], // рівні тейків (% від входу)
          tpGridSizePct: [40, 30, 30], // частки позиції для фіксації
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
      oiWindow: 10, // кількість 5m-свічок для Open Interest (~50 хв)
      liqWindow: 20, // кількість хвилин для аналізу ліквідності
      liqSentWindow: 5, // хвилин для ліквідацій
      fundingWindow: 80, // хвилин усереднення funding rate
      volWindow: 14, // період ATR (волатильність)
      corrWindow: 5, // хвилин для перевірки кореляції з BTC

      // --- Ваги модулів у підсумковому скорі ---
      weights: {
        trend: 0.25, // тренд найбільш важливий
        liquidity: 0.2,
        funding: 0.15,
        liquidations: 0.15,
        openInterest: 0.15,
        correlation: 0.1,
      },

      // --- Мінімальна сила сигналів від кожного модуля (0–100) ---
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
          tpGridPct: [0.8, 1.5, 2], // рівні тейків (% від входу)
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
