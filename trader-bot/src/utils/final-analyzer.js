// utils/final-analyzer.js
import { analyzeCandles } from '../modules/candles/analyze-сandles.js';
import { analyzeLiquidity } from '../modules/orderbook/analyze-liquidity.js';
import { analyzeLiquidations } from '../modules/liquidations/analyze-liquidations.js';
import { analyzeOpenInterest } from '../modules/openinterest/analyze-openinterest.js';
import { analyzeVolatility } from '../modules/volatility/analyze-volatility.js';
import { analyzeFunding } from '../modules/funding/analyze-funding.js';
import { analyzeCorrelation } from '../modules/correlation/analyze-correlation.js';
import { analyzeTrendRegime } from '../modules/trendRegime/analyze-trend-regime.js';
import { analyzeLongShort } from '../modules/longshort/analyze-longshort.js';
import { saveDoc, loadDocs } from '../storage/storage.js';
import { aggregateCandles } from './candles.js';

export async function finalAnalyzer({
                                      symbol = 'ETHUSDT',
                                      analysisConfig = {},
                                      save = true,
                                    } = {}) {
  const {
    candleTimeframe = '1m',
    oiWindow = 10,
    liqWindow = 20,
    liqSentWindow = 5,
    fundingWindow = 60,
    volWindow = 14,
    corrWindow = 5,
    longShortWindow = 5,
    weights = {},
    moduleThresholds = {},
  } = analysisConfig;

  // --- завантажуємо й агрегуємо 1m свічки ---
  const rawCandles = await loadDocs('candles', symbol, 500);
  const candles = aggregateCandles(rawCandles, candleTimeframe);

  // --- модулі ---
  const modules = {};
  modules.trend       = await analyzeCandles(symbol, candles);
  modules.volatility  = await analyzeVolatility(symbol, candles, volWindow);
  modules.trendRegime = await analyzeTrendRegime(symbol, candles, 14);

  modules.liquidity    = await analyzeLiquidity(symbol, liqWindow);
  modules.funding      = await analyzeFunding(symbol, fundingWindow);
  modules.liquidations = await analyzeLiquidations(symbol, liqSentWindow);
  modules.openInterest = await analyzeOpenInterest(symbol, oiWindow);
  modules.correlation  = await analyzeCorrelation(symbol, corrWindow);
  modules.longShort    = await analyzeLongShort(symbol, longShortWindow);

  // --- скоринг ---
  function weightedScore(side) {
    return Object.entries(modules).reduce((acc, [k, v]) => {
      if (!v) return acc;
      const value = v.meta?.[side] || 0; // беремо з meta
      const threshold = moduleThresholds[k] || 0;
      if (value < threshold) return acc;
      return acc + value * (weights[k] || 0);
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
      (m) => m && ((m.meta?.LONG ?? 0) + (m.meta?.SHORT ?? 0) > 0),
  ).length;

  // --- дебаг таблиця ---
  const debugRows = Object.entries(modules).map(([k, v]) => ({
    module: k,
    signal: v?.signal || '—',
    LONG: v?.meta?.LONG ?? 0,
    SHORT: v?.meta?.SHORT ?? 0,
    strength: v?.strength ?? 0,
    weight: weights[k] || 0,
    threshold: moduleThresholds[k] || 0,
    passed: v
        ? ((v.meta?.LONG ?? 0) >= (moduleThresholds[k] || 0)) ||
        ((v.meta?.SHORT ?? 0) >= (moduleThresholds[k] || 0))
        : false,
  }));
  console.table(debugRows);

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