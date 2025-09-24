// trading/core/engine.js
import axios from 'axios';
import { loadDocs } from '../../storage/storage.js';
import { getActivePositions } from './positions.js';
import { preparePosition } from './prepare.js';
import { getHigherTF } from '../../utils/timeframes.js';
import { analyzeVolatility } from '../../modules/volatility/analyze-volatility.js';
import { analyzeCandles } from '../../modules/candles/analyze-сandles.js';
import { executeTrade } from '../binance/exchange-executor.js';
import { getUserTrades } from '../binance/binance.js';
import { notifyTrade } from '../../utils/notify.js';

const TRADE_MODE = process.env.TRADE_MODE || 'paper';

export async function tradingEngine(symbol, config) {
  const lookback = 3;
  const analysisHistory = await loadDocs('analysis', symbol, lookback);

  // 0. Перевіряємо відкриті позиції
  const activePositions = await getActivePositions(symbol);
  if (activePositions.length > 0) {
    console.log(`⚠️ ${symbol}: skip, already active position exists`);
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
              `⏸️ ${symbol}: cooldown ${cooldown}m, залишилось ${(cooldown - minutesSince).toFixed(1)}m`,
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
    console.log(`⚠️ ${symbol}: skip, not enough analyses (need ${lookback})`);
    return;
  }

  // 1. аналізи
  const lastAnalyses = analysisHistory.reverse();
  const analysis = lastAnalyses.at(-1);
  const decisions = lastAnalyses.map((a) => a.bias);

  // 2. більшість
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

  // 3. перевірка останнього аналізу
  if (analysis.bias !== majority) {
    console.log(
      `⚠️ ${symbol}: skip, last analysis bias ${analysis.bias} ≠ majority ${majority}`,
    );
    return;
  }

  const { entry, capital } = config.strategy;
  const { scores, modules, coverage } = analysis;

  // 3a. min score
  const minScore = entry.minScore[majority];
  if (scores[majority] < minScore) {
    console.log(
      `⚠️ ${symbol}: skip, score ${scores[majority]} < minScore ${minScore}`,
    );
    return;
  }

  // 3b. min modules
  if (coverage) {
    const [filled] = coverage.split('/').map(Number);
    if (filled < entry.minModules) {
      console.log(
        `⚠️ ${symbol}: skip, only ${filled} modules < min ${entry.minModules}`,
      );
      return;
    }
  }

  // 3c. required modules
  if (entry.requiredModules?.length) {
    for (const req of entry.requiredModules) {
      if (!modules[req] || (modules[req].signal ?? 'NEUTRAL') === 'NEUTRAL') {
        console.log(`⚠️ ${symbol}: skip, required module ${req} not confirmed`);
        return;
      }
    }
  }

  // 3d. side bias tolerance
  const diff = Math.abs(scores.LONG - scores.SHORT);
  if (diff < entry.sideBiasTolerance) {
    console.log(
      `⚠️ ${symbol}: skip, bias difference ${diff} < tolerance ${entry.sideBiasTolerance}`,
    );
    return;
  }

  // 3e. volatility filter
  if (modules?.volatility) {
    const { signal, meta } = modules.volatility;
    if (signal === 'NONE' && meta?.regime === 'DEAD') {
      console.log(`⚠️ ${symbol}: skip, market DEAD volatility`);
      return;
    }
    if (signal === 'NONE' && meta?.regime === 'EXTREME') {
      console.log(`⚠️ ${symbol}: EXTREME volatility, reducing risk`);
      capital.riskPerTradePct = capital.riskPerTradePct / 2;
    }
  }

  // 3f. spread filter
  if (modules?.liquidity?.meta?.spreadPct > entry.maxSpreadPct) {
    console.log(
      `⚠️ ${symbol}: skip, spread ${modules.liquidity.meta.spreadPct}% > max ${entry.maxSpreadPct}%`,
    );
    return;
  }

  // 3g. funding filter
  const fr = modules?.funding?.meta?.avgFunding;
  const absOver = entry.avoidWhen?.fundingExtreme?.absOver;
  if (absOver && Math.abs(fr) > absOver) {
    console.log(`⚠️ ${symbol}: skip, funding extreme ${fr}`);
    return;
  }

  // 3h. trend regime → advisory
  if (!modules?.trendRegime || modules.trendRegime.signal === 'NEUTRAL') {
    console.log(`ℹ️ ${symbol}: ADX regime NEUTRAL (no trend)`);
  }

  // 4. higher TF
  const mainTF = config.analysisConfig.candleTimeframe || '1m';
  const higherTF = getHigherTF(mainTF);
  if (higherTF) {
    // беремо невелику кількість свічок для старшого ТФ
    const limit = 100;
    const klineRes = await axios.get(
      'https://fapi.binance.com/fapi/v1/klines',
      {
        params: { symbol, interval: higherTF, limit },
      },
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
      console.log(`⚠️ ${symbol}: skip, no higher TF data (${higherTF})`);
      return;
    }

    if (higherTrend.signal !== majority) {
      console.log(
        `ℹ️ ${symbol}: higher TF ${higherTF} conflict (trend=${higherTrend.signal})`,
      );
      capital.riskPerTradePct = capital.riskPerTradePct / 2;
    }

    if (higherVol.signal === 'NONE' && higherVol.meta?.regime === 'DEAD') {
      console.log(`⚠️ ${symbol}: skip, higher TF ${higherTF} DEAD volatility`);
      return;
    }
  }

  // --- 5. отримуємо останню ціну для входу ---
  const lastPriceRes = await axios.get(
    'https://fapi.binance.com/fapi/v1/ticker/price',
    {
      params: { symbol },
    },
  );
  const entryPrice = parseFloat(lastPriceRes.data.price);

  // 6. відкриття угоди
  if (TRADE_MODE === 'live') {
    const position = await executeTrade(
      symbol,
      config,
      analysis,
      majority,
      entryPrice,
    );
    if (position) {
      console.log(`🟢 [LIVE] New Binance position opened:`, position);
      notifyTrade(position, 'OPENED');
    }
  } else {
    const position = await preparePosition(
      symbol,
      config,
      analysis,
      majority,
      entryPrice,
    );
    console.log(`🟢 [PAPER] New simulated position opened:`, position);
    notifyTrade(position, 'OPENED');
  }
}
