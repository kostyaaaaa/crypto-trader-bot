// tooltips.ts
export const TIPS: Record<string, string> = {
  // ====== ROOT ======
  isActive:
    'Вмикає/вимикає торгування для цього інструмента. Якщо вимкнено — жодні аналізи/ордера не виконуються.',
  symbol: 'Торговий символ (фʼючери Binance).',

  // ====== ANALYSIS CONFIG ======
  'analysisConfig.candleTimeframe':
    'Таймфрейм свічок для більшості модулів аналізу (trend, volatility, тощо). Менший ТФ — швидше реагує, більше шуму.',
  'analysisConfig.oiWindow':
    'Кількість свічок для розрахунку Open Interest (вікно зміни OI). Більше — плавніше, повільніше.',
  'analysisConfig.liqWindow':
    'Кількість точок orderbook/ліквідності для усереднення. Занадто мале вікно дає шум.',
  'analysisConfig.liqSentWindow':
    'Скільки останніх "ліквідаційних" свічок усереднюємо для sentiment по ліквідаціях.',
  'analysisConfig.volWindow':
    'Вікно для ATR/волатильності. Впливає на позначки DEAD/EXTREME.',
  'analysisConfig.corrWindow':
    'Скільки свічок беремо для кореляції з BTC. Більше — стабільніше, повільніше.',
  'analysisConfig.longShortWindow':
    'Вікно для метрики Long/Short ratio (біржова статистика/рикети).',

  // Weights — множники модульних балів у фінальному скорі:
  'analysisConfig.weights.trend':
    'Вага модуля trend у підсумковому скорі. Від 0 до 1. Більше — тренд сильніше впливає.',
  'analysisConfig.weights.trendRegime':
    'Вага ADX/DI режиму тренду. Підсилює сигнали сили/слабкості тренду.',
  'analysisConfig.weights.liquidity':
    'Вага ліквідності/балансу книги заявок. Підвищуйте для монет із частими "сквізами".',
  'analysisConfig.weights.liquidations':
    'Вага ліквідацій (де ріжуть лонги/шорти). Корисно для ловлі імпульсів.',
  'analysisConfig.weights.openInterest':
    'Вага зміни OI (нові позиції/закриття). Часто корелює з продовженням руху.',
  'analysisConfig.weights.longShort':
    'Вага біржового Long/Short балансу. Малий обсяг — обережно з довірою.',
  'analysisConfig.weights.higherMA':
    'Вага старшого таймфрейму MA-кросу як фільтра глобального тренду.',

  // Thresholds — мін. бал модуля (0–100), нижче якого модуль НЕ додається у скори:
  'analysisConfig.moduleThresholds.trend':
    'Мінімальна сила trend, щоб враховувати модуль у скорі.',
  'analysisConfig.moduleThresholds.trendRegime':
    'Мінімальна сила ADX/DI, щоб рахувати режим тренду.',
  'analysisConfig.moduleThresholds.liquidity':
    'Поріг для модуля ліквідності. Низькі значення зазвичай = шум.',
  'analysisConfig.moduleThresholds.liquidations':
    'Поріг для ліквідацій, щоби уникати слабких дисбалансів.',
  'analysisConfig.moduleThresholds.openInterest':
    'Поріг зміни OI. Високі пороги — тільки явні притоки/відтоки.',
  'analysisConfig.moduleThresholds.longShort': 'Поріг дисбалансу Long/Short.',
  'analysisConfig.moduleThresholds.higherMA':
    'Поріг для сигналу MA-кросу старшого ТФ.',

  // Higher MA (старший таймфрейм фільтр)
  'analysisConfig.higherMA.timeframe':
    'Таймфрейм для MA-кросу (наприклад, 4h/1d). Слугує глобальним фільтром.',
  'analysisConfig.higherMA.maShort':
    'Коротка MA для кросу (період). Менше — швидше реагує.',
  'analysisConfig.higherMA.maLong':
    'Довга MA для кросу (період). Формує “базовий” тренд.',
  'analysisConfig.higherMA.type':
    'Тип середньої: EMA або SMA. EMA швидше реагує, SMA — більш гладка.',
  'analysisConfig.higherMA.thresholdPct':
    'Мінімальний відсотковий розрив між MA/ціною для визнання сигналу.',
  'analysisConfig.higherMA.scale':
    'Коефіцієнт перетворення розриву у бали модуля (чим більше — тим легше набрати 100).',
  'analysisConfig.higherMA.emaSeed':
    'Метод ініціалізації EMA (first/sma). Впливає на стабільність стартових значень.',

  // ====== STRATEGY — ENTRY ======
  'strategy.entry.minScore.LONG':
    'Мінімальний підсумковий бал для входу в LONG. Підвищення — рідше входи, краща якість.',
  'strategy.entry.minScore.SHORT':
    'Мінімальний підсумковий бал для входу в SHORT.',
  'strategy.entry.minModules':
    'Мінімальна кількість модулів, що пройшли свої пороги, щоб дозволити вхід.',
  'strategy.entry.requiredModules':
    'Список модулів, які ОБОВʼЯЗКОВО мають пройти поріг (інакше входу немає).',
  'strategy.entry.maxSpreadPct':
    'Максимальний спред (у %) між найкращою заявкою та ціною. Захист від тонкого ринку/слипейджу.',
  'strategy.entry.cooldownMin':
    'Мінімальна пауза (хв) між новими входами по цьому символу.',
  'strategy.entry.avoidWhen.volatility':
    'Пропускати угоди при певному режимі волатильності (напр., DEAD).',
  'strategy.entry.sideBiasTolerance':
    'Дозволена різниця між LONG і SHORT скором, щоб прийняти сторону. Менше — суворіше.',

  // ====== STRATEGY — VOLATILITY FILTER ======
  'strategy.volatilityFilter.deadBelow':
    'ATR% нижче якого ринок вважаємо DEAD (млявий).',
  'strategy.volatilityFilter.extremeAbove':
    'ATR% вище якого ринок EXTREME (ризик ривків/слипейджу).',

  // ====== STRATEGY — CAPITAL ======
  'strategy.capital.account':
    'Розмір рахунку (USD) для розрахунку ризику. У paper-тесті — умовний.',
  'strategy.capital.riskPerTradePct':
    'Ризик на угоду у % від акаунта (керує обсягом позиції).',
  'strategy.capital.leverage':
    'Плече на біржі. Впливає на маржу та ліквідаційний рівень.',
  'strategy.capital.maxConcurrentPositions':
    'Максимальна кількість одночасних позицій по акаунту.',

  // ====== STRATEGY — SIZING (DCA) ======
  'strategy.sizing.maxAdds': 'Макс. кількість доливів (DCA) в одну позицію.',
  'strategy.sizing.addOnAdverseMovePct':
    'Триґер доливу: просадка ціни проти позиції на X% (PnL%).',
  'strategy.sizing.addMultiplier':
    'Розмір кожного доливу як частка поточного нотіоналу (1 = 100%, 0.5 = 50% тощо).',

  // ====== STRATEGY — EXITS: TP ======
  'strategy.exits.tp.use': 'Вмикає сітку тейк-профітів.',
  'strategy.exits.tp.tpGridPct':
    'Масив цілей TP у % PnL (наприклад, [1.5, 3]).',
  'strategy.exits.tp.tpGridSizePct':
    'Масив часток позиції, що закриваємо на кожному TP (% сумарного обсягу).',

  // ====== STRATEGY — EXITS: SL ======
  'strategy.exits.sl.type':
    'Тип стопа: hard — фіксований % від входу; atr — динамічний як k×ATR.',
  'strategy.exits.sl.hardPct': 'Рівень hard-стопа у %. Працює, якщо type=hard.',
  'strategy.exits.sl.atrMult':
    'Множник ATR для динамічного SL. Працює, якщо type=atr.',
  'strategy.exits.sl.signalRules.flipIf.scoreGap':
    'Форс-вихід/реверс: якщо протилежний скор випереджає на X пунктів…',
  'strategy.exits.sl.signalRules.flipIf.minOppScore':
    '…і при цьому протилежний скор не менший за цей поріг.',
  'strategy.exits.sl.signalRules.moduleFail.required':
    'Список модулів, провал яких (нижче порога) дає сигнал на вихід.',

  // ====== STRATEGY — EXITS: TIME ======
  'strategy.exits.time.maxHoldMin':
    'Максимальний час утримання (хв). 0 — без обмеження.',
  'strategy.exits.time.noPnLFallback':
    'Що робити, якщо час вийшов, а PnL ≈ 0: нічого/закрити невеликий мінус/тощо.',

  // ====== STRATEGY — EXITS: TRAILING ======
  'strategy.exits.trailing.use': 'Вмикає трейлінг-стоп.',
  'strategy.exits.trailing.startAfterPct':
    'PnL% для активації трелу (коли ціна пройшла у наш бік на X%).',
  'strategy.exits.trailing.trailStepPct':
    'Відстань SL від пікової ціни (PnL%) після активації трелу (менше — щільніший супровід).',

  // ====== STRATEGY — EXITS: інше ======
  'strategy.exits.oppositeCountExit':
    'Закрити позицію, якщо останні N аналізів по черзі дають протилежний бʼяс (0 = вимкнено).',
};

// Підтримка імен типу "tpGridPct.0" / "tpGridPct[0]" / тощо:
export function getTip(name: string): string | undefined {
  const normalized = name
    .replace(/\[(\d+)\]/g, '.$1') // arr[0] -> arr.0
    .replace(/\.$/, '');
  if (TIPS[normalized]) return TIPS[normalized];

  // якщо останній сегмент — число (масив) прибираємо його і перевіряємо батьківський ключ
  const noIndex = normalized.replace(/\.\d+$/, '');
  return TIPS[noIndex];
}
