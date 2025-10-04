// modules/longshort/analyze-longshort.js
// --- Глобальне співвідношення Long vs Short акаунтів ---
// API: /futures/data/globalLongShortAccountRatio

import axios from 'axios';
import logger from '../../utils/db-logger.js';

export async function analyzeLongShort(symbol = 'ETHUSDT', window = 5) {
  try {
    const url =
      'https://fapi.binance.com/futures/data/globalLongShortAccountRatio';
    const res = await axios.get(url, {
      params: {
        symbol,
        period: '5m',
        limit: window,
      },
    });

    if (!res.data || res.data.length < window) {
      return null;
    }

    const data = res.data.map((d) => ({
      time: new Date(d.timestamp).toISOString(),
      longPct: parseFloat(d.longAccount) * 100,
      shortPct: parseFloat(d.shortAccount) * 100,
      ratio: parseFloat(d.longShortRatio),
    }));

    // середні значення по вікну
    const avgLong = data.reduce((s, c) => s + c.longPct, 0) / data.length;
    const avgShort = data.reduce((s, c) => s + c.shortPct, 0) / data.length;

    // нормалізація
    const total = avgLong + avgShort;
    const longPct = total > 0 ? (avgLong / total) * 100 : 50;
    const shortPct = total > 0 ? (avgShort / total) * 100 : 50;

    // визначаємо сигнал із "мертвою зоною" 5 п.п. і силу як переважаючу сторону
    const diff = Math.abs(longPct - shortPct);
    let signal = 'NEUTRAL';
    if (diff > 5) {
      signal = longPct > shortPct ? 'LONG' : 'SHORT';
    }

    // 👉 сила модуля = переважаюча сторона (0..100), щоб бути консистентними з іншими модулями
    const strength = Math.max(longPct, shortPct);

    // розрахунок періоду, який покриває вікно
    const minutesCovered = window * 5;
    const hoursCovered = (minutesCovered / 60).toFixed(1);

    return {
      module: 'longShort',
      symbol,
      signal,
      strength,
      meta: {
        LONG: Number(longPct.toFixed(3)),
        SHORT: Number(shortPct.toFixed(3)),
        candlesUsed: data.length,
        avgLong: Number(avgLong.toFixed(2)),
        avgShort: Number(avgShort.toFixed(2)),
        periodCovered: `${minutesCovered}m (~${hoursCovered}h)`, // 🆕 додано
      },
    };
  } catch (e) {
    logger.error('❌ Error fetching long/short ratio:', e.message);
    return null;
  }
}
