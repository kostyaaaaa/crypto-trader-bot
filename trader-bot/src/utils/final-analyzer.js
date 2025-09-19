// utils/final-analyzer.js
import { analyzeCandles } from '../modules/candles/analyze-сandles.js';
import { analyzeLiquidity } from '../modules/orderbook/analyze-liquidity.js';
import { analyzeLiquidations } from '../modules/liquidations/analyze-liquidations.js';
import { analyzeOpenInterest } from '../modules/openinterest/analyze-openinterest.js';
import { analyzeVolatility } from '../modules/volatility/analyze-volatility.js';
import { analyzeFunding } from '../modules/funding/analyze-funding.js';
import { analyzeCorrelation } from '../modules/correlation/analyze-correlation.js';
import { saveDoc, loadDocs } from '../storage/storage.js';
import { aggregateCandles } from './candles.js';

export async function finalAnalyzer({
  symbol = 'ETHUSDT',
  analysisConfig = {},
  save = true, // ⚡️ новий прапорець — чи зберігати результат
} = {}) {
  const {
    candleTimeframe = '1m',
    oiWindow = 10,
    liqWindow = 20,
    liqSentWindow = 5,
    fundingWindow = 60,
    volWindow = 14,
    corrWindow = 5,
    weights = {},
    moduleThresholds = {},
  } = analysisConfig;

  // --- завантажуємо і агрегуємо 1m свічки ---
  const rawCandles = await loadDocs('candles', symbol, 500);
  const candles = aggregateCandles(rawCandles, candleTimeframe);
  const modules = {};

  // всі модулі тепер отримують готові свічки!
  modules.trend = await analyzeCandles(symbol, candles);
  modules.volatility = await analyzeVolatility(symbol, candles, volWindow);

  modules.liquidity = await analyzeLiquidity(symbol, liqWindow);
  modules.funding = await analyzeFunding(symbol, fundingWindow);
  modules.liquidations = await analyzeLiquidations(symbol, liqSentWindow);
  modules.openInterest = await analyzeOpenInterest(symbol, oiWindow);
  modules.correlation = await analyzeCorrelation(symbol, corrWindow);

  // --- скорінг ---
  function weightedScore(side) {
    return Object.entries(modules).reduce((acc, [k, v]) => {
      if (!v) return acc;
      const strength = v[side] || 0;
      const threshold = moduleThresholds[k] || 0;
      if (strength < threshold) return acc;
      return acc + strength * (weights[k] || 0);
    }, 0);
  }

  const scoreLONG = weightedScore('LONG');
  const scoreSHORT = weightedScore('SHORT');

  let decision = 'NO TRADE';
  if (scoreLONG > 65) decision = 'STRONG LONG';
  else if (scoreLONG > 50) decision = 'WEAK LONG';
  else if (scoreSHORT > 65) decision = 'STRONG SHORT';
  else if (scoreSHORT > 50) decision = 'WEAK SHORT';

  const bias =
    scoreLONG > scoreSHORT
      ? 'LONG'
      : scoreSHORT > scoreLONG
        ? 'SHORT'
        : 'NEUTRAL';

  const filledModules = Object.values(modules).filter(
    (m) => (m?.LONG || 0) + (m?.SHORT || 0) > 0,
  ).length;

  const result = {
    time: new Date().toISOString(),
    symbol,
    timeframe: candleTimeframe,
    modules,
    scores: {
      LONG: Number(scoreLONG.toFixed(1)),
      SHORT: Number(scoreSHORT.toFixed(1)),
    },
    coverage: `${filledModules}/${Object.keys(modules).length}`,
    bias,
    decision,
  };

  if (save) {
    await saveDoc('analysis', result);
  }

  return result;
}
