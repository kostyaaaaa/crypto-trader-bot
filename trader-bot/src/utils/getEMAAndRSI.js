// getEMAAndRSI.js
// --- Допоміжні функції для аналізу технічних індикаторів ---

/**
 * Експоненціальне ковзне середнє (EMA)
 * @param {number[]} values - масив цін (наприклад, close)
 * @param {number} period - період EMA (наприклад, 9 або 21)
 * @returns {number} останнє значення EMA
 */
export function EMA(values, period) {
  if (!values || values.length < period) return null;

  const k = 2 / (period + 1); // множник згладжування
  let ema = values[0]; // починаємо з першого значення

  for (let i = 1; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k);
  }

  return ema;
}

/**
 * Індекс відносної сили (RSI)
 * @param {number[]} values - масив цін (close)
 * @param {number} period - період RSI (стандартно 14)
 * @returns {number|null} RSI (0–100), або null якщо мало даних
 */
export function RSI(values, period = 14) {
  if (!values || values.length < period + 1) return null;

  let gains = 0;
  let losses = 0;

  // рахуємо зміни за останній період
  for (let i = values.length - period; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff; // беремо модуль втрат
  }

  const rs = gains / (losses || 1); // щоб уникнути ділення на 0
  return 100 - 100 / (1 + rs); // формула RSI
}
