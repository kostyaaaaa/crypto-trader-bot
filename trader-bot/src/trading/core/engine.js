// trading/core/engine.js
import axios from 'axios';
import { analyzeCandles } from '../../analize-modules/candles/analyze-сandles.js';
import { analyzeVolatility } from '../../analize-modules/volatility/analyze-volatility.js';
import { loadDocs } from '../../storage/storage.js';
import { notifyTrade } from '../../utils/notify.js';
import { getHigherTF } from '../../utils/timeframes.js';
import { getUserTrades } from '../binance/binance.js';
import { executeTrade } from '../binance/exchange-executor.js';
import { getActivePositions } from './binance-positions-manager.js';
import { preparePosition } from './prepare.js';

import { openPosition } from './historyStore.js';

const TRADE_MODE = process.env.TRADE_MODE || 'paper';

export async function tradingEngine(symbol, config) {
  const lookback = 3;
  const analysisHistory = await loadDocs('analysis', symbol, lookback);

  // 0. Перевіряємо відкриті позиції
  const activePositions = await getActivePositions(symbol);
  if (activePositions.length > 0) {
    console.log(`⏸️ ${symbol}: skip, active positions exist`);
    return;
  }
  // cooldown
  if (config.strategy.entry.cooldownMin > 0) {
    try {
      const trades = await getUserTrades(symbol, { limit: 50 });
      if (Array.isArray(trades) && trades.length) {
        const lastClosed = [...trades]
          .reverse()
          .find((t) => Number(t.realizedPnl) !== 0);
        if (lastClosed) {
          const closedAt = new Date(lastClosed.time);
          const minutesSince = (Date.now() - closedAt.getTime()) / 60000;
          const cooldown = config.strategy.entry.cooldownMin;

          if (minutesSince < cooldown) {
            console.log(
              `⏸️ ${symbol}: cooldown ${cooldown}m, залишилось ${(
                cooldown - minutesSince
              ).toFixed(1)}m`,
            );
            return;
          }
        }
      }
    } catch (err) {
      console.error(
        `⚠️ ${symbol}: failed to check cooldown via trades`,
        err?.message || err,
      );
    }
  }

  if (!analysisHistory || analysisHistory.length < lookback) {
    return;
  }

  const lastAnalyses = analysisHistory.reverse();

  const analysis = lastAnalyses.at(-1);
  const decisions = lastAnalyses.map((a) => a.bias);

  const majority = decisions
    .sort(
      (a, b) =>
        decisions.filter((v) => v === a).length -
        decisions.filter((v) => v === b).length,
    )
    .pop();

  if (majority === 'NEUTRAL') {
    console.log(`⚠️ ${symbol}: skip, majority is NEUTRAL`);
    return;
  }

  if (analysis.bias !== majority) {
    console.log(`⏸️ ${symbol}: skip, analysis.bias !== majority`);
    return;
  }

  const { entry, capital } = config.strategy;
  const { scores, modules, coverage } = analysis;

  const minScore = entry.minScore[majority];
  if (scores[majority] < minScore) {
    console.log(
      `⏸️ ${symbol}: skip, score ${scores[majority]} < minScore ${minScore}`,
    );
    return;
  }

  if (coverage) {
    const [filled] = coverage.split('/').map(Number);
    if (filled < entry.minModules) {
      console.log(
        `⏸️ ${symbol}: skip, coverage ${filled} < minModules ${entry.minModules}`,
      );
      return;
    }
  }

  if (entry.requiredModules?.length) {
    for (const req of entry.requiredModules) {
      if (!modules[req] || (modules[req].signal ?? 'NEUTRAL') === 'NEUTRAL') {
        console.log(`⏸️ ${symbol}: skip, required module ${req} not satisfied`);
        return;
      }
    }
  }

  const diff = Math.abs(scores.LONG - scores.SHORT);
  if (diff < entry.sideBiasTolerance) {
    console.log(
      `⏸️ ${symbol}: skip, side bias diff ${diff} < tolerance ${entry.sideBiasTolerance}`,
    );
    return;
  }

  if (modules?.volatility) {
    const { signal, meta } = modules.volatility;
    if (signal === 'NONE' && meta?.regime === 'DEAD') {
      console.log(`⏸️ ${symbol}: skip, volatility regime DEAD`);
      return;
    }
    // if (signal === 'NONE' && meta?.regime === 'EXTREME') {
    //   capital.riskPerTradePct = capital.riskPerTradePct / 2;
    // }
  }

  if (modules?.liquidity?.meta?.spreadPct > entry.maxSpreadPct) {
    console.log(
      `⏸️ ${symbol}: skip, spread ${modules.liquidity.meta.spreadPct} > maxSpreadPct ${entry.maxSpreadPct}`,
    );
    return;
  }

  const fr = modules?.funding?.meta?.avgFunding;
  const absOver = entry.avoidWhen?.fundingExtreme?.absOver;
  if (absOver && Math.abs(fr) > absOver) {
    console.log(`⏸️ ${symbol}: skip, funding extreme abs(${fr}) > ${absOver}`);
    return;
  }

  if (!modules?.trendRegime || modules.trendRegime.signal === 'NEUTRAL') {
    console.log(`ℹ️ ${symbol}: ADX regime NEUTRAL (no trend)`);
  }

  const mainTF = config.analysisConfig.candleTimeframe || '1m';
  const higherTF = getHigherTF(mainTF);
  if (higherTF) {
    const limit = 100;
    const klineRes = await axios.get(
      'https://fapi.binance.com/fapi/v1/klines',
      { params: { symbol, interval: higherTF, limit } },
    );
    const candles = klineRes.data.map((k) => ({
      time: new Date(k[0]).toISOString(),
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5]),
    }));

    const higherTrend = await analyzeCandles(symbol, candles);
    const higherVol = await analyzeVolatility(symbol, candles, 14);

    if (!higherTrend || !higherVol) {
      return;
    }

    if (higherTrend.signal !== majority) {
      console.log(
        `⚠️ ${symbol}: higherTrend.signal !== majority, risk reduced`,
      );
      capital.riskPerTradePct = capital.riskPerTradePct / 2;
    }

    if (higherVol.signal === 'NONE' && higherVol.meta?.regime === 'DEAD') {
      console.log(`⏸️ ${symbol}: skip, higherVol regime DEAD`);
      return;
    }
  }

  const lastPriceRes = await axios.get(
    'https://fapi.binance.com/fapi/v1/ticker/price',
    { params: { symbol } },
  );
  const entryPrice = parseFloat(lastPriceRes.data.price);

  let position;
  if (TRADE_MODE === 'live') {
    position = await executeTrade(
      symbol,
      config,
      analysis,
      majority,
      entryPrice,
    );

    if (position) {
      notifyTrade(position, 'OPENED');

      await openPosition(symbol, {
        side: position.side,
        entryPrice: position.entryPrice,
        size: position.size,
        stopLoss: position.stop,
        takeProfits: position.takeProfits,
        trailingCfg: config.strategy?.exits?.trailing,
        analysis,
        strategyMeta: {
          leverage: config.strategy.capital?.leverage,
          riskPct: config.strategy.capital?.riskPerTradePct,
          strategyName: config.strategy.name || null,
        },
        orderIds: {
          entry: position.orderId,
          stop: position.stopOrderId,
          takes: position.takeOrderIds || [],
        },
      });
    }
  } else {
    position = await preparePosition(
      symbol,
      config,
      analysis,
      majority,
      entryPrice,
    );
    notifyTrade(position, 'OPENED');

    await openPosition(symbol, {
      side: position.side,
      entryPrice: position.entryPrice,
      size: position.size,
      stopLoss: position.stopLoss,
      takeProfits: position.takeProfits,
      trailingCfg: config.strategy?.exits?.trailing,
      analysis,
      strategyMeta: {
        leverage: config.strategy.capital?.leverage,
        riskPct: config.strategy.capital?.riskPerTradePct,
        strategyName: config.strategy.name || null,
      },
      orderIds: {
        entry: position.orderId,
        stop: position.stopOrderId,
        takes: position.takeOrderIds || [],
      },
    });
  }
}
