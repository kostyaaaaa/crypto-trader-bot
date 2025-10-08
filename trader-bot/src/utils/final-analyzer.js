import axios from 'axios';
import {
  analyzeCandles,
  analyzeChoppiness,
  analyzeFunding,
  analyzeHigherMA,
  analyzeLiquidations,
  analyzeLiquidity,
  analyzeLongShort,
  analyzeOpenInterest,
  analyzeRsiVolumeTrend,
  analyzeTrendRegime,
  analyzeVolatility,
} from '../analize-modules/index.js';

import { saveDoc } from '../storage/storage.js';
import logger from './db-logger.js';

export async function finalAnalyzer({
  symbol = 'ETHUSDT',
  analysisConfig = {},
  strategy = {},
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
  // Required candles for RSI+Volume+Trend (module uses hardcoded params)
  // RSI_WARMUP=100, RSI_PERIOD=50, MA_LONG=25, VOL_LOOKBACK=10
  const neededRsiVol = Math.max(
    100 + 50 + 5, // warmup + rsi + safety
    25 + 10 + 5, // maLong + volLookback + safety
  );
  const needed =
    Math.max(
      21,
      volWindow,
      corrWindow,
      oiWindow,
      fundingWindow,
      longShortWindow,
      neededRsiVol,
    ) + 5;
  // --- свічки напряму з Binance ---
  let klineRes;
  try {
    klineRes = await axios.get('https://fapi.binance.com/fapi/v1/klines', {
      params: { symbol, interval: candleTimeframe, limit: needed },
    });
  } catch (err) {
    if (err && err.code === 'ENOTFOUND') {
      logger.warn(`⚠️ ${symbol} skipped (DNS error)`);
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
  modules.volatility = await analyzeVolatility(
    symbol,
    candles,
    volWindow,
    strategy.volatilityFilter || { deadBelow: 0.2, extremeAbove: 2.5 },
  );
  modules.trendRegime = await analyzeTrendRegime(symbol, candles, {
    period: 14,
    adxSignalMin: moduleThresholds.trendRegime ?? 20,
  });
  // RSI + Volume + Trend module (uses provided candles, no REST, hardcoded params)
  modules.rsiVolTrend = await analyzeRsiVolumeTrend(symbol, candles);
  // Choppiness Index module (fetches its own 1m candles, analyzes market choppiness)
  modules.choppiness = await analyzeChoppiness(symbol, 10);
  modules.liquidity = await analyzeLiquidity(symbol, liqWindow, lastPrice);
  modules.funding = await analyzeFunding(symbol, fundingWindow);
  modules.liquidations = await analyzeLiquidations(symbol);
  modules.openInterest = await analyzeOpenInterest(symbol, oiWindow);
  modules.longShort = await analyzeLongShort(symbol, longShortWindow);
  modules.higherMA = await analyzeHigherMA(
    symbol,
    analysisConfig.higherMA || {
      timeframe: '1d',
      maShort: 7,
      maLong: 14,
      type: 'SMA',
      thresholdPct: 0.2,
      scale: 12,
      emaSeed: 'sma',
    },
  );

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

  const gap = Math.abs(scoreLONG - scoreSHORT);
  const biasTolerance = Number(strategy?.entry?.sideBiasTolerance ?? 0);

  const dominantSide = scoreLONG >= scoreSHORT ? 'LONG' : 'SHORT';
  const bestScore = Math.max(scoreLONG, scoreSHORT);

  let decision = 'NO TRADE';
  if (gap >= biasTolerance && bestScore >= 50) {
    const label = bestScore >= 65 ? 'STRONG' : 'WEAK';
    decision = `${label} ${dominantSide}`;
  }

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
