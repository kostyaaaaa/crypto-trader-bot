// modules/correlation/analyze-correlation.js
// --- Аналізує кореляцію з BTC ---
// Якщо торгуємо alt (ETH, SOL, ADA…), а BTC сильно рухається → враховуємо цей сигнал
// Дані беремо напряму з Binance API (історичні kline)

import axios from 'axios';
import { correlationGroups } from '../../constants/correlation-config.js';

// Визначаємо групу (наскільки сильно символ корелює з BTC)
function getGroup(symbol) {
  symbol = symbol.toUpperCase();
  if (correlationGroups.strong.includes(symbol)) return 'strong';
  if (correlationGroups.medium.includes(symbol)) return 'medium';
  if (correlationGroups.weak.includes(symbol)) return 'weak';
  return null;
}

export async function analyzeCorrelation(symbol, window = 5) {
  const group = getGroup(symbol);
  if (!group) {
    return {
      module: 'correlation',
      symbol,
      signal: 'NEUTRAL',
      strength: 0,
      meta: { group: 'none' },
    };
  }

  try {
    // беремо історію 5-хвилинних свічок BTCUSDT
    const url = 'https://fapi.binance.com/fapi/v1/klines';
    const res = await axios.get(url, {
      params: {
        symbol: 'BTCUSDT',
        interval: '5m',
        limit: window,
      },
    });

    if (!res.data || res.data.length < window) {
      console.log(`⚠️ Not enough BTC candles, need ${window}`);
      return null;
    }

    const closes = res.data.map((k) => parseFloat(k[4])); // close price
    const first = closes[0];
    const last = closes[closes.length - 1];

    // зміна BTC (%)
    const btcChangePct = ((last - first) / first) * 100;

    // базовий сигнал
    let signal = 'NEUTRAL';
    let longScore = 50;
    let shortScore = 50;

    if (btcChangePct > 0.5) {
      signal = 'LONG';
      longScore = 50 + Math.min(Math.abs(btcChangePct) * 5, 50);
      shortScore = 100 - longScore;
    } else if (btcChangePct < -0.5) {
      signal = 'SHORT';
      shortScore = 50 + Math.min(Math.abs(btcChangePct) * 5, 50);
      longScore = 100 - shortScore;
    }

    // коефіцієнт впливу від групи
    const weights = { strong: 1.0, medium: 0.6, weak: 0.3 };
    const weight = weights[group];

    const weightedLong = Math.round(longScore * weight);
    const weightedShort = Math.round(shortScore * weight);

    return {
      module: 'correlation',
      symbol,
      signal,
      strength: Math.max(weightedLong, weightedShort),
      meta: {
        LONG: weightedLong,
        SHORT: weightedShort,
        candlesUsed: closes.length,
        btcChangePct: parseFloat(btcChangePct.toFixed(2)),
        group,
        weight,
        periodCoveredMin: window * 5, // 5 хв × N
      },
    };
  } catch (e) {
    console.error('❌ Correlation fetch error:', e.message);
    return null;
  }
}
