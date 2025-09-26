// modules/funding/analyze-funding.js
// --- Аналіз Funding Rate напряму з Binance ---
// API: /fapi/v1/fundingRate
// Логіка:
//   funding > 0 → перевага LONGів → SHORT-сигнал
//   funding < 0 → перевага SHORTів → LONG-сигнал

import axios from 'axios';

export async function analyzeFunding(symbol = 'ETHUSDT', window = 60) {
  try {
    const url = 'https://fapi.binance.com/fapi/v1/fundingRate';
    const res = await axios.get(url, {
      params: {
        symbol,
        limit: window, // одразу беремо останні N записів
      },
    });

    if (!res.data || res.data.length === 0) {
      console.log(`⚠️ No funding data for ${symbol}`);
      return null;
    }

    // кожен fundingRate = 8h → покритий період
    const hoursCovered = window * 8;
    const daysCovered = (hoursCovered / 24).toFixed(1);

    // беремо останні N
    const candles = res.data.map((fr) => ({
      symbol,
      time: new Date(fr.fundingTime).toISOString(),
      fundingRate: parseFloat(fr.fundingRate),
    }));

    if (candles.length < window) {
      console.log(`⚠️ Not enough funding data for ${symbol}, need ${window}`);
      return null;
    }

    // середній funding rate за період
    const avgFunding =
      candles.reduce((s, c) => s + (c.fundingRate || 0), 0) / candles.length;

    let signal = 'NEUTRAL';
    let longScore = 50;
    let shortScore = 50;

    if (avgFunding > 0) {
      signal = 'SHORT';
      shortScore = Math.min(100, 50 + avgFunding * 1000);
      longScore = 100 - shortScore;
    } else if (avgFunding < 0) {
      signal = 'LONG';
      longScore = Math.min(100, 50 + Math.abs(avgFunding) * 1000);
      shortScore = 100 - longScore;
    }

    const roundedLong = Math.round(longScore);
    const roundedShort = Math.round(shortScore);

    return {
      module: 'funding',
      symbol,
      signal,
      strength: Math.max(roundedLong, roundedShort),
      meta: {
        LONG: roundedLong,
        SHORT: roundedShort,
        candlesUsed: candles.length,
        avgFunding: parseFloat(avgFunding.toFixed(5)),
        periodCovered: `${hoursCovered}h (~${daysCovered} days)`, // 🆕 додаємо
      },
    };
  } catch (e) {
    console.error(`❌ Funding fetch/analyze error for ${symbol}:`, e.message);
    return null;
  }
}
