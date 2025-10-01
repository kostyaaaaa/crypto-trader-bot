import { EMA, RSI } from '../../utils/getEMAAndRSI.js';

export async function genyaTrendModule(symbol = 'ETHUSDT', candles = []) {
  if (!candles || candles.length < 21) {
    console.log(
      `⏳ Лише ${candles?.length || 0} свічок для ${symbol}, потрібно ≥21...`,
    );
    return null;
  }

  const lastCandles = candles.slice(-21);

  const closes = lastCandles.map((c) => c.close);
  const volumes = lastCandles.map((c) => Number(c.volume ?? 0));

  // 📊 Індикатори
  const emaFast = EMA(closes, 9, { seed: 'sma' });
  const emaSlow = EMA(closes, 21, { seed: 'sma' });
  const rsi = RSI(closes, 14);

  const avgVolume = volumes.reduce((sum, num) => sum + num, 0) / volumes.length;
  const lastVolume = volumes[volumes.length - 1];

  // 🔹 Умови тренду
  const trendUp = emaFast > emaSlow;
  const trendDown = emaFast < emaSlow;
  const strongVolume = lastVolume > avgVolume;

  let signal = 'NEUTRAL';
  let reason = 'Немає чіткого тренду';

  // 🔹 Фільтр по RSI
  if (rsi > 70) {
    signal = 'OVERBOUGHT';
    reason = 'RSI > 70, ринок перегрітий, лонг небезпечний';
  } else if (rsi < 30) {
    signal = 'OVERSOLD';
    reason = 'RSI < 30, ринок перепроданий, шорт небезпечний';
  } else {
    // 🔹 Основна логіка (EMA + RSI 45/55 + об’єм)
    if (trendUp && rsi > 55) {
      signal = strongVolume ? 'STRONG_LONG' : 'WEAK_LONG';
      reason = strongVolume
        ? 'EMA9 > EMA21, RSI > 55 та об’єм вище середнього'
        : 'EMA9 > EMA21 та RSI > 55, але об’єм слабкий';
    } else if (trendDown && rsi < 45) {
      signal = strongVolume ? 'STRONG_SHORT' : 'WEAK_SHORT';
      reason = strongVolume
        ? 'EMA9 < EMA21, RSI < 45 та об’єм вище середнього'
        : 'EMA9 < EMA21 та RSI < 45, але об’єм слабкий';
    }
  }

  // 🔹 Розрахунок "сили" сигналу

  let strength = 0; // базове значення
  if (trendUp || trendDown) strength += 20; // тренд
  if (strongVolume) strength += 15; // об’єм

  // RSI для лонгу
  if (rsi > 55) strength += (rsi - 55) * 0.5;
  // Умова: RSI більший за 55 → ринок трохи перекуплений і лонг більш сильний.
  // Вираховуємо: (rsi - 55) → наскільки RSI перевищує 55.
  // Наприклад, якщо RSI = 65 → 65 − 55 = 10
  // Множимо на 0.5: (rsi - 55) * 0.5 → масштабування, щоб не давати занадто великий приріст.
  // Продовжуючи приклад: 10 * 0.5 = +5
  // Результат: strength збільшується на 5, тобто сигнал стає сильнішим завдяки високому RSI.

  // RSI для шорту
  if (rsi < 45) strength += (45 - rsi) * 0.5;
  // Умова: RSI менший за 45 → ринок трохи перепроданий і шорт більш сильний.
  // Вираховуємо: (45 - rsi) → наскільки RSI менший за 45.
  // Наприклад, якщо RSI = 35 → 45 − 35 = 10
  // Множимо на 0.5: (45 - rsi) * 0.5 → теж масштабування.
  // Продовжуючи приклад: 10 * 0.5 = +5
  // Результат: strength збільшується на 5, сигнал шорту стає сильнішим.

  return {
    module: 'trend',
    symbol,
    signal,
    reason,
    strength: parseFloat(strength.toFixed(1)),
    meta: {
      emaFast: parseFloat(emaFast.toFixed(2)),
      emaSlow: parseFloat(emaSlow.toFixed(2)),
      rsi: parseFloat(rsi.toFixed(2)),
      lastVolume,
      averageVolume: parseFloat(avgVolume.toFixed(2)),
      trend: trendUp ? 'UP' : trendDown ? 'DOWN' : 'FLAT',
    },
  };
}
