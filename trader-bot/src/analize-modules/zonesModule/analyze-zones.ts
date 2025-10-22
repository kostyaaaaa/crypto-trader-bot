import type { IZonesModule } from 'crypto-trader-db';
import { getMarkFromHub } from '../../trading/core/helpers/monitor-helpers';
import type { Candle } from '../../types/candles';

export async function analyzeZones(
  symbol: string = 'ETHUSDT',
  candles: Candle[] = [],
): Promise<IZonesModule | null> {
  if (!candles || candles.length < 5) return null;

  const recentCandles = candles.slice(-100);
  const lastClosedCandle = recentCandles[recentCandles.length - 1];
  if (!lastClosedCandle) return null;

  const referencePrice = lastClosedCandle.close;

  const currentPrice = (await getMarkFromHub(symbol)) ?? lastClosedCandle.open;

  const resistanceLevels: number[] = [];
  const supportLevels: number[] = [];

  // --- Поиск локальных экстремумов ---
  for (let i = 1; i < recentCandles.length - 1; i++) {
    const prev = recentCandles[i - 1];
    const curr = recentCandles[i];
    const next = recentCandles[i + 1];

    if (curr.high > prev.high && curr.high > next.high)
      resistanceLevels.push(curr.high);
    if (curr.low < prev.low && curr.low < next.low)
      supportLevels.push(curr.low);
  }

  // --- Новый deduplicate ---
  const deduplicate = (levels: number[]) => {
    if (!levels.length) return [];
    const sorted = [...new Set(levels.sort((a, b) => a - b))];

    // адаптивный порог на основе среднего диапазона свечей
    const avgRange =
      recentCandles.reduce((acc, c) => acc + (c.high - c.low), 0) /
      recentCandles.length;

    const filtered: number[] = [];
    for (const lvl of sorted) {
      if (filtered.length === 0) filtered.push(lvl);
      else {
        const last = filtered[filtered.length - 1];
        if (Math.abs(lvl - last) > avgRange * 0.5) filtered.push(lvl);
      }
    }
    return filtered;
  };

  const supports = deduplicate(supportLevels)
    .filter((l) => l < referencePrice)
    .slice(-2);
  const resistances = deduplicate(resistanceLevels)
    .filter((l) => l > referencePrice)
    .slice(0, 2);

  // безопасное заполнение, если зон мало
  while (supports.length < 2)
    supports.unshift(supports[0] ?? referencePrice * 0.98);
  while (resistances.length < 2)
    resistances.push(
      resistances[resistances.length - 1] ?? referencePrice * 1.02,
    );

  const [secondarySupport, primarySupport] = supports;
  const [primaryResistance, secondaryResistance] = resistances;

  // ---- Скоринг ----
  const epsilon = 0.02; // 2% допуска
  let longFromSupport = 50;
  let shortFromResistance = 50;

  // --- Поддержка ---
  if (currentPrice > primarySupport) {
    const factor = Math.min(
      Math.max(
        (referencePrice - currentPrice) / (referencePrice - primarySupport),
        0,
      ),
      1,
    );
    longFromSupport = 50 + 50 * factor;
  } else if (
    currentPrice <= primarySupport &&
    currentPrice > secondarySupport
  ) {
    const factor = Math.min(
      Math.max(
        (primarySupport - currentPrice) / (primarySupport - secondarySupport),
        0,
      ),
      1,
    );
    longFromSupport = 75 + 25 * factor;
  } else if (
    currentPrice <= secondarySupport &&
    currentPrice >= secondarySupport * (1 - epsilon)
  ) {
    longFromSupport = 100;
  } else if (currentPrice < secondarySupport * (1 - epsilon)) {
    longFromSupport = 0; // сильный пробой вниз
  }

  // --- Сопротивление ---
  if (currentPrice < primaryResistance) {
    const factor = Math.min(
      Math.max(
        (currentPrice - referencePrice) / (primaryResistance - referencePrice),
        0,
      ),
      1,
    );
    shortFromResistance = 50 + 50 * factor;
  } else if (
    currentPrice >= primaryResistance &&
    currentPrice < secondaryResistance
  ) {
    const factor = Math.min(
      Math.max(
        (currentPrice - primaryResistance) /
          (secondaryResistance - primaryResistance),
        0,
      ),
      1,
    );
    shortFromResistance = 75 + 25 * factor;
  } else if (
    currentPrice >= secondaryResistance &&
    currentPrice <= secondaryResistance * (1 + epsilon)
  ) {
    shortFromResistance = 100;
  } else if (currentPrice > secondaryResistance * (1 + epsilon)) {
    shortFromResistance = 0; // сильный пробой вверх
  }

  // --- Итоговое объединение влияний ---
  const longScore = Math.min(
    Math.max((longFromSupport + (100 - shortFromResistance)) / 2, 0),
    100,
  );
  const shortScore = 100 - longScore;

  return {
    type: 'scoring',
    module: 'zones',
    symbol,
    meta: {
      support1: primarySupport ?? null,
      support2: secondarySupport ?? null,
      resistance1: primaryResistance ?? null,
      resistance2: secondaryResistance ?? null,
      referencePrice,
      currentPrice,
      LONG: longScore,
      SHORT: shortScore,
      candlesUsed: recentCandles.length,
    },
  };
}
