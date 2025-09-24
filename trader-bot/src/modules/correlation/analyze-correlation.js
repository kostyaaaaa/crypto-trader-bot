// modules/correlation/analyze-correlation.js
// --- Аналізує кореляцію з BTC ---
// Якщо торгуємо alt (ETH, SOL, ADA…), а BTC сильно рухається → враховуємо цей сигнал
// Працює через групи кореляції (strong, medium, weak), які ми задаємо в correlation-config.js

import { correlationGroups } from '../../constants/correlation-config.js';
import { loadDocs } from '../../storage/storage.js';

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
      signal: 'NEUTRAL', // уніфіковано (було "NONE")
      strength: 0,
      meta: { group: 'none' },
    };
  }

  // читаємо історію BTC
  const btc = await loadDocs('btc', 'BTCUSDT', window);
  if (!btc || btc.length < window) {
    console.log(`⚠️ Only ${btc?.length || 0} BTC candles, need ${window}`);
    return null;
  }

  const recent = btc.slice(-window);
  const first = recent[0];
  const last = recent[recent.length - 1];

  // зміна BTC (%)
  const btcChangePct = ((last.close - first.close) / first.close) * 100;

  // базовий сигнал: BTC > +0.5% → LONG, < −0.5% → SHORT
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
    signal, // LONG | SHORT | NEUTRAL
    strength: Math.max(weightedLong, weightedShort),
    meta: {
      LONG: weightedLong,
      SHORT: weightedShort,
      candlesUsed: recent.length,
      btcChangePct: parseFloat(btcChangePct.toFixed(2)),
      group,
      weight,
    },
  };
}
