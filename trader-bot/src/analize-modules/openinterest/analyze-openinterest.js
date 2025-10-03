// modules/openinterest/analyze-open-interest.js
// --- Аналіз Open Interest + Price ---
// Матриця напрямку:
//  • OI↑ + Price↑ → LONG
//  • OI↑ + Price↓ → SHORT
//  • OI↓ + Price↑ → SHORT (fake move)
//  • OI↓ + Price↓ → LONG (short covering)

import axios from 'axios';
import logger from '../../utils/db-logger.js';

export async function analyzeOpenInterest(symbol = 'ETHUSDT', window = 5) {
  try {
    // 1) Історія OI з Binance (5m)
    const oiRes = await axios.get(
      'https://fapi.binance.com/futures/data/openInterestHist',
      { params: { symbol, period: '5m', limit: window } },
    );
    if (!oiRes.data || oiRes.data.length < window) {
      return null;
    }

    // 2) Історія свічок (5m) з Binance
    const klineRes = await axios.get(
      'https://fapi.binance.com/fapi/v1/klines',
      { params: { symbol, interval: '5m', limit: window } },
    );
    if (!klineRes.data || klineRes.data.length < window) {
      return null;
    }

    // 3) Зводимо історію
    const recent = [];
    for (let i = 0; i < window; i++) {
      recent.push({
        openInterest: parseFloat(oiRes.data[i].sumOpenInterest),
        openInterestValue: parseFloat(oiRes.data[i].sumOpenInterestValue),
        price: parseFloat(klineRes.data[i][4]), // close ціна
      });
    }

    const first = recent[0];
    const last = recent[recent.length - 1];

    // захист від ділення на 0
    const safePct = (end, start) =>
      start && isFinite(start) ? ((end - start) / start) * 100 : 0;

    const oiChangePct = safePct(last.openInterest, first.openInterest);
    const oiValueChangePct = safePct(
      last.openInterestValue,
      first.openInterestValue,
    );
    const priceChangePct = safePct(last.price, first.price);

    // Напрямок: +1 → LONG, -1 → SHORT
    const sameDirection =
      (oiChangePct >= 0 && priceChangePct >= 0) ||
      (oiChangePct < 0 && priceChangePct < 0);
    const sign = sameDirection ? +1 : -1;

    // Комбінована сила
    const mag = 0.6 * Math.abs(oiChangePct) + 0.4 * Math.abs(priceChangePct);

    // Дуже малий рух → нейтральний
    if (mag < 0.05) {
      return {
        module: 'openInterest',
        symbol,
        signal: 'NEUTRAL',
        strength: 0,
        meta: {
          LONG: 50,
          SHORT: 50,
          candlesUsed: recent.length,
          periodCovered: `${window * 5}m (~${((window * 5) / 60).toFixed(1)}h)`, // 🆕
          oiChangePct: to2(oiChangePct),
          oiValueChangePct: to2(oiValueChangePct),
          priceChangePct: to2(priceChangePct),
        },
      };
    }

    // Логістична функція для плавного скейлу
    const k = 0.35;
    const pLong = 1 / (1 + Math.exp(-k * sign * mag));
    const longScore = Math.round(pLong * 100);
    const shortScore = 100 - longScore;

    let signal = 'LONG';
    if (shortScore > longScore) signal = 'SHORT';
    if (Math.abs(longScore - shortScore) < 5) signal = 'NEUTRAL';

    return {
      module: 'openInterest',
      symbol,
      signal,
      strength: Math.max(longScore, shortScore),
      meta: {
        LONG: longScore,
        SHORT: shortScore,
        candlesUsed: recent.length,
        periodCovered: `${window * 5}m (~${((window * 5) / 60).toFixed(1)}h)`, // 🆕
        oiChangePct: to2(oiChangePct),
        oiValueChangePct: to2(oiValueChangePct),
        priceChangePct: to2(priceChangePct),
      },
    };
  } catch (err) {
    logger.error('❌ analyzeOpenInterest error:', err.message);
    return null;
  }
}

const to2 = (x) => (Number.isFinite(x) ? Number(x.toFixed(2)) : 0);
