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
} from '../analize-modules/index.ts';
import { saveDoc } from '../storage/storage.ts';
import type { BinanceKline, Candle } from '../types/index.ts';

import logger from './db-logger.ts';

import type {
  IAnalysis,
  IAnalysisConfig,
  IAnalysisModules,
  IChoppinessModule,
  IFundingModule,
  IHigherMAModule,
  ILiquidationsModule,
  ILiquidityModule,
  ILongShortModule,
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
    fundingWindow = 60,
    volWindow = 14,
    corrWindow = 5,
    longShortWindow = 5,
    weights,
    moduleThresholds,
    higherMA,
  } = analysisConfig;

  const neededRsiVol = Math.max(100 + 50 + 5, 25 + 10 + 5);
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

  let klineRes: { data: BinanceKline[] } | undefined;

  try {
    klineRes = await axios.get('https://fapi.binance.com/fapi/v1/klines', {
      params: { symbol, interval: candleTimeframe, limit: needed },
    });
  } catch (err: any) {
    if (err && err.code === 'ENOTFOUND') {
      logger.warn(`⚠️ ${symbol} skipped (DNS error)`);
      return null;
    }
    throw err;
  }
  if (!klineRes) return null;

  const candles: Candle[] = klineRes.data.map((k) => ({
    time: new Date(k[0]).toISOString(),
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5]),
  }));

  const lastPrice = candles[candles.length - 1]?.close ?? null;

  const modules: IAnalysisModules = {
    trend: null,
    volatility: null,
    trendRegime: null,
    liquidity: null,
    funding: null,
    liquidations: null,
    openInterest: null,
    longShort: null,
    higherMA: null,
    rsiVolTrend: null,
    choppiness: null,
  };

  modules.trend = (await analyzeCandles(
    symbol,
    candles,
  )) as ITrendModule | null;

  modules.choppiness = (await analyzeChoppiness(
    symbol,
    21,
  )) as IChoppinessModule | null;
  modules.volatility = (await analyzeVolatility(
    symbol,
    candles,
    volWindow,
    (strategy as IStrategyConfig).volatilityFilter || {
      deadBelow: 0.2,
      extremeAbove: 2.5,
    },
  )) as IVolatilityModule | null;

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

  modules.funding = (await analyzeFunding(
    symbol,
    fundingWindow,
  )) as IFundingModule | null;

  modules.liquidations = (await analyzeLiquidations(
    symbol,
  )) as ILiquidationsModule | null;

  modules.openInterest = (await analyzeOpenInterest(
    symbol,
    oiWindow,
  )) as IOpenInterestModule | null;

  modules.longShort = (await analyzeLongShort(
    symbol,
    longShortWindow,
  )) as ILongShortModule | null;

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

  // --- скоринг ---
  function weightedScore(side: 'LONG' | 'SHORT'): number {
    return Object.entries(modules).reduce((acc, [, v]) => {
      if (!v) return acc;
      const value = Number(v.meta?.[side]) || 0;
      const key = v.module as keyof typeof weights;
      const threshold = Number(moduleThresholds[key]) || 0;
      if (value < threshold) return acc;
      const w = Number(weights[key]) || 0;
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

  const filledModules = Object.values(modules).filter(
    (m) => m && (Number(m.meta?.LONG) || 0) + (Number(m.meta?.SHORT) || 0) > 0,
  ).length;

  const result: IAnalysis = {
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

  await saveDoc('analysis', result as IAnalysis);
  return result;
}
