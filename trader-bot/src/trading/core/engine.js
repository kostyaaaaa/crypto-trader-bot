// trading/core/engine.js
import { loadDocs } from '../../storage/storage.js';
import { notifyTrade } from '../../utils/notify.js';
import { getUserTrades } from '../binance/binance.js';
import { executeTrade } from '../binance/exchange-executor.js';
import { getActivePositions } from './binance-positions-manager.js';
import { preparePosition } from './prepare.js';

import logger from '../../utils/db-logger.js';
import { openPosition } from './historyStore.js';
import markPriceHub from './mark-price-hub.js';

async function getRealtimeMark(symbol) {
  const m = markPriceHub.getMark(symbol);
  if (m && !m.stale) return m.markPrice;
  const first = await markPriceHub.waitForMark(symbol);
  return first?.markPrice ?? null;
}

const TRADE_MODE = process.env.TRADE_MODE || 'paper';

export async function tradingEngine(symbol, config) {
  const lookback = config?.entry?.lookback || 3;
  const analysisHistory = await loadDocs('analysis', symbol, lookback);
  const entryPrice = await getRealtimeMark(symbol);
  // 0. Перевіряємо відкриті позиції
  const activePositions = await getActivePositions(symbol);
  if (activePositions.length > 0) {
    logger.info(`⏸️ ${symbol}: skip, active positions exist`);
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
            logger.info(
              `⏸️ ${symbol}: cooldown ${cooldown}m, залишилось ${(
                cooldown - minutesSince
              ).toFixed(1)}m`,
            );
            return;
          }
        }
      }
    } catch (err) {
      logger.error(
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

  // Majority vote with strict rule: need > floor(n/2), else NEUTRAL; tie-break by recency
  function majorityVoteStrict(list) {
    if (!Array.isArray(list) || list.length === 0) return 'NEUTRAL';
    const counts = list.reduce((acc, v) => {
      acc[v] = (acc[v] || 0) + 1;
      return acc;
    }, {});

    let best = 'NEUTRAL';
    let bestCount = 0;
    for (const [k, c] of Object.entries(counts)) {
      if (c > bestCount) {
        best = k;
        bestCount = c;
      } else if (c === bestCount) {
        // tie-breaker: prefer the most recent occurrence in list
        if (list.lastIndexOf(k) > list.lastIndexOf(best)) {
          best = k;
        }
      }
    }

    return bestCount > Math.floor(list.length / 2) ? best : 'NEUTRAL';
  }

  const majority = majorityVoteStrict(decisions);

  if (majority === 'NEUTRAL') {
    logger.info(`⚠️ ${symbol}: skip, majority is NEUTRAL`);
    return;
  }

  if (analysis.bias !== majority) {
    logger.info(`⏸️ ${symbol}: skip, analysis.bias !== majority`);
    return;
  }

  const { entry } = config.strategy;
  // Gate: only enforce higher-TF trend agreement if 'higherMA' is marked as required
  const required = Array.isArray(config?.strategy?.entry?.requiredModules)
    ? config.strategy.entry.requiredModules
    : [];
  // ---- risk handling: do not mutate global config ----
  const baseRiskPct = Number(config?.strategy?.capital?.riskPerTradePct ?? 0);
  let riskFactor = 1; // will be adjusted by higherTF / volatility gates

  const { scores, modules, coverage } = analysis;

  const minScore = entry.minScore[majority];
  if (scores[majority] < minScore) {
    logger.info(
      `⏸️ ${symbol}: skip, score ${scores[majority]} < minScore ${minScore}`,
    );
    return;
  }

  if (coverage) {
    const [filled] = coverage.split('/').map(Number);
    if (filled < entry.minModules) {
      logger.info(
        `⏸️ ${symbol}: skip, coverage ${filled} < minModules ${entry.minModules}`,
      );
      return;
    }
  }

  if (entry.requiredModules?.length) {
    for (const req of entry.requiredModules) {
      if (!modules[req] || (modules[req].signal ?? 'NEUTRAL') === 'NEUTRAL') {
        logger.info(`⏸️ ${symbol}: skip, required module ${req} not satisfied`);
        return;
      }
    }
  }

  // If higherMA is marked as required, enforce its agreement with majority (no extra REST calls)
  if (required.includes('higherMA')) {
    const hmSignal = modules?.higherMA?.signal || 'NEUTRAL';
    if (hmSignal !== majority) {
      logger.info(
        `⏸️ ${symbol}: skip, higherMA(${hmSignal}) ≠ majority(${majority})`,
      );
      return;
    }
  }

  const diff = Math.abs(scores.LONG - scores.SHORT);
  if (diff < entry.sideBiasTolerance) {
    logger.info(
      `⏸️ ${symbol}: skip, side bias diff ${diff} < tolerance ${entry.sideBiasTolerance}`,
    );
    return;
  }

  if (modules?.volatility) {
    const { signal, meta } = modules.volatility;
    if (signal === 'NONE' && meta?.regime === 'DEAD') {
      logger.info(`⏸️ ${symbol}: skip, volatility regime DEAD`);
      return;
    }
    if (signal === 'NONE' && meta?.regime === 'EXTREME') {
      // do not compound risk cuts; apply the strongest single cut
      return;
    }
  }

  if (modules?.liquidity?.meta?.spreadPct > entry.maxSpreadPct) {
    logger.info(
      `⏸️ ${symbol}: skip, spread ${modules.liquidity.meta.spreadPct} > maxSpreadPct ${entry.maxSpreadPct}`,
    );
    return;
  }

  const fr = modules?.funding?.meta?.avgFunding;
  const absOver = entry.avoidWhen?.fundingExtreme?.absOver;
  if (absOver && Math.abs(fr) > absOver) {
    logger.info(`⏸️ ${symbol}: skip, funding extreme abs(${fr}) > ${absOver}`);
    return;
  }

  if (!modules?.trendRegime || modules.trendRegime.signal === 'NEUTRAL') {
    logger.info(`ℹ️ ${symbol}: ADX regime NEUTRAL (no trend)`);
  }

  if (entryPrice == null || !Number.isFinite(entryPrice)) {
    logger.warn(`⚠️ ${symbol}: skip, no fresh mark price available`);
    return;
  }

  // Build a per-trade config without mutating the original
  const runConfig = JSON.parse(JSON.stringify(config));
  runConfig.strategy.capital.riskPerTradePct = baseRiskPct * riskFactor;
  logger.info(
    `[RISK] ${symbol} base=${baseRiskPct}% × factor=${riskFactor} → effective=${runConfig.strategy.capital.riskPerTradePct}%`,
  );

  let position;

  if (TRADE_MODE === 'live') {
    position = await executeTrade(
      symbol,
      runConfig,
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
        trailingCfg: runConfig.strategy?.exits?.trailing,
        analysis,
        strategyMeta: {
          leverage: runConfig.strategy.capital?.leverage,
          riskPct: runConfig.strategy.capital?.riskPerTradePct,
          strategyName: runConfig.strategy.name || null,
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
      runConfig,
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
      trailingCfg: runConfig.strategy?.exits?.trailing,
      analysis,
      strategyMeta: {
        leverage: runConfig.strategy.capital?.leverage,
        riskPct: runConfig.strategy.capital?.riskPerTradePct,
        strategyName: runConfig.strategy.name || null,
      },
      orderIds: {
        entry: position.orderId,
        stop: position.stopOrderId,
        takes: position.takeOrderIds || [],
      },
    });
  }
}
