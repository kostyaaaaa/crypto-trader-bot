import {
  analyzeHigherMA,
  analyzeLiquidations,
  analyzeLiquidity,
  analyzeMomentum,
  analyzeOpenInterest,
  analyzeRsiVolumeTrend,
  analyzeTrend,
  analyzeTrendRegime,
  analyzeVolatility,
  analyzeVolume,
} from '../analize-modules/index';
import { submitAnalysis } from '../api';
import type { Candle } from '../types/index';
import { getCandlesWithFallback } from './candles-helper';

import logger from './db-logger';

import type {
  IAnalysis,
  IAnalysisConfig,
  IAnalysisModules,
  IHigherMAModule,
  ILiquidationsModule,
  ILiquidityModule,
  IOpenInterestModule,
  IRsiVolTrendModule,
  IStrategyConfig,
  ITrendModule,
  ITrendRegimeModule,
  IVolatilityModule,
} from 'crypto-trader-db';

export interface FinalAnalyzerArgs {
  symbol: string;
  analysisConfig: IAnalysisConfig;
  strategy: IStrategyConfig;
}
export async function finalAnalyzer({
  symbol = 'ETHUSDT',
  analysisConfig,
  strategy,
}: FinalAnalyzerArgs): Promise<IAnalysis | null> {
  const {
    candleTimeframe = '1m',
    oiWindow = 10,
    liqWindow = 20,
    volWindow = 14,
    corrWindow = 5,
    weights,
    moduleThresholds,
    higherMA,
  } = analysisConfig;

  const neededRsiVol = Math.max(100 + 50 + 5, 25 + 10 + 5);
  const needed =
    Math.max(21, volWindow, corrWindow, oiWindow, neededRsiVol) + 5;

  let candles: Candle[] = [];

  try {
    // Отримуємо свічки з WebSocket даних з fallback на HTTP
    const candlesData = await getCandlesWithFallback(
      symbol,
      candleTimeframe,
      needed,
    );

    candles = candlesData.map((candle) => ({
      time: new Date(candle.time).toISOString(),
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume,
    }));
  } catch (err: any) {
    if (err && err.code === 'ENOTFOUND') {
      logger.warn(`⚠️ ${symbol} skipped (DNS error)`);
      return null;
    }
    throw err;
  }

  if (candles.length === 0) return null;

  const lastPrice = candles[candles.length - 1]?.close ?? null;

  const modules: IAnalysisModules = {
    trend: null,
    volatility: null,
    trendRegime: null,
    liquidity: null,
    liquidations: null,
    openInterest: null,
    higherMA: null,
    rsiVolTrend: null,
    // New modules (not used in scoring/validation yet)
    volume: null,
    momentum: null,
  };

  modules.trend = (await analyzeTrend(symbol, candles)) as ITrendModule | null;

  modules.volatility = (await analyzeVolatility(
    symbol,
    candles,
    volWindow,
    (strategy as IStrategyConfig).volatilityFilter || {
      minThreshold: 0.2,
      maxThreshold: 2.5,
    },
  )) as IVolatilityModule | null;

  modules.liquidations = (await analyzeLiquidations(
    symbol,
  )) as ILiquidationsModule | null;

  modules.trendRegime = (await analyzeTrendRegime(symbol, candles, {
    period: 14,
    adxSignalMin: moduleThresholds['trendRegime'] ?? 20,
  })) as ITrendRegimeModule | null;

  modules.rsiVolTrend = (await analyzeRsiVolumeTrend(
    symbol,
    candles,
  )) as IRsiVolTrendModule | null;

  modules.liquidity = (await analyzeLiquidity(
    symbol,
    liqWindow,
    lastPrice,
  )) as ILiquidityModule | null;

  modules.openInterest = (await analyzeOpenInterest(
    symbol,
    oiWindow,
  )) as IOpenInterestModule | null;

  modules.higherMA = (await analyzeHigherMA(
    symbol,
    higherMA || {
      timeframe: '1d',
      maShort: 7,
      maLong: 14,
      type: 'SMA',
      thresholdPct: 0.2,
      scale: 12,
      emaSeed: 'sma',
    },
  )) as IHigherMAModule | null;

  // New modules (for data collection only, not used in scoring/validation)
  modules.volume = (await analyzeVolume(symbol, candles)) as any;
  modules.momentum = (await analyzeMomentum(symbol, candles)) as any;

  // --- скоринг (only scoring modules, not validation) ---
  const scoringModuleNames = [
    'trend',
    'trendRegime',
    'liquidity',
    'openInterest',
    'higherMA',
    'rsiVolTrend',
  ];

  function weightedScore(side: 'LONG' | 'SHORT'): number {
    return Object.entries(modules).reduce((acc, [key, v]) => {
      if (!v || !scoringModuleNames.includes(key)) return acc; // Skip validation modules
      const value = Number(v.meta?.[side]) || 0;
      const moduleKey = v.module as keyof typeof weights;
      const threshold = Number(moduleThresholds[moduleKey]) || 0;
      if (value < threshold) return acc;
      const w = Number(weights[moduleKey]) || 0;
      return acc + value * w;
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

  // Count only scoring modules with non-zero scores
  const filledModules = Object.entries(modules).filter(([key, m]) => {
    if (!m || !scoringModuleNames.includes(key)) return false;
    const longScore = Number(m.meta?.LONG) || 0;
    const shortScore = Number(m.meta?.SHORT) || 0;
    return longScore > 0 || shortScore > 0;
  }).length;

  const totalScoringModules = scoringModuleNames.length;

  const result: IAnalysis = {
    time: new Date(),
    symbol,
    timeframe: candleTimeframe,
    modules,
    scores: {
      LONG: Number(scoreLONG.toFixed(1)),
      SHORT: Number(scoreSHORT.toFixed(1)),
    },
    coverage: `${filledModules}/${totalScoringModules}`,
    bias,
    decision,
  };

  await submitAnalysis(result as IAnalysis);
  return result;
}
