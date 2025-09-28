import axios from 'axios';
import { analyzeCandles } from '../analize-modules/candles/analyze-сandles.js';
import { analyzeCorrelation } from '../analize-modules/correlation/analyze-correlation.js';
import { analyzeFunding } from '../analize-modules/funding/analyze-funding.js';
import { analyzeLiquidations } from '../analize-modules/liquidations/analyze-liquidations.js';
import { analyzeLongShort } from '../analize-modules/longshort/analyze-longshort.js';
import { analyzeOpenInterest } from '../analize-modules/openinterest/analyze-openinterest.js';
import { analyzeLiquidity } from '../analize-modules/orderbook/analyze-liquidity.js';
import { analyzeTrendRegime } from '../analize-modules/trendRegime/analyze-trend-regime.js';
import { analyzeVolatility } from '../analize-modules/volatility/analyze-volatility.js';
import { saveDoc } from '../storage/storage.js';

export async function finalAnalyzer({
  symbol = 'ETHUSDT',
  analysisConfig = {},
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
  const needed =
    Math.max(
      21,
      volWindow,
      corrWindow,
      oiWindow,
      fundingWindow,
      longShortWindow,
    ) + 5;
  // --- свічки напряму з Binance ---
  let klineRes;
  try {
    klineRes = await axios.get('https://fapi.binance.com/fapi/v1/klines', {
      params: { symbol, interval: candleTimeframe, limit: needed },
    });
  } catch (err) {
    if (err && err.code === 'ENOTFOUND') {
      console.warn(`⚠️ ${symbol} skipped (DNS error)`);
      return null;
    }
    throw err;
  }
  if (!klineRes) return null;
  const candles = klineRes.data.map((k) => ({
    time: new Date(k[0]).toISOString(),
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5]),
  }));
  const lastPrice = candles[candles.length - 1]?.close || null;

  // --- модулі ---
  const modules = {};
  modules.trend = await analyzeCandles(symbol, candles);
  modules.volatility = await analyzeVolatility(symbol, candles, volWindow);
  modules.trendRegime = await analyzeTrendRegime(symbol, candles, {
    period: 14,
    adxSignalMin: moduleThresholds.trendRegime ?? 20,
  });

  modules.liquidity = await analyzeLiquidity(symbol, liqWindow, lastPrice);
  modules.funding = await analyzeFunding(symbol, fundingWindow);
  modules.liquidations = await analyzeLiquidations(symbol, liqSentWindow);
  modules.openInterest = await analyzeOpenInterest(symbol, oiWindow);
  modules.correlation = await analyzeCorrelation(symbol, corrWindow);
  modules.longShort = await analyzeLongShort(symbol, longShortWindow);

  // --- скоринг ---
  function weightedScore(side) {
    return Object.entries(modules).reduce((acc, [k, v]) => {
      if (!v) return acc;
      const value = v.meta?.[side] || 0;
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
    (m) => m && (m.meta?.LONG ?? 0) + (m.meta?.SHORT ?? 0) > 0,
  ).length;

  const result = {
    time: new Date(),
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
  await saveDoc('analysis', result);
  return result;
}
