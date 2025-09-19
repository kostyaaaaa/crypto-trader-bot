// trading/engine.js
import { loadDocs } from '../storage/storage.js';
import { calculatePositionSize } from './risk.js';
import { addPosition, getActivePositions } from './positions.js';
import { preparePosition } from './prepare.js';
import { getHigherTF } from '../utils/timeframes.js';
import { analyzeVolatility } from '../modules/volatility/analyze-volatility.js';
import { aggregateCandles } from '../utils/candles.js';
import { analyzeCandles } from '../modules/candles/analyze-сandles.js';

export async function tradingEngine(symbol, config) {
  const lookback = 3;
  const analysisHistory = await loadDocs('analysis', symbol, lookback);
  const activePositions = await getActivePositions(symbol);

  if (activePositions.length > 0) {
    console.log(`⚠️ ${symbol}: skip, already active position exists`);
    return;
  }

  // --- cooldown по історії ---
  const history = await loadDocs('history', symbol, 50);
  if (history?.length) {
    const lastClosed = [...history].reverse().find((p) => p.symbol === symbol);
    if (lastClosed?.closedAt) {
      const minutesSince =
        (Date.now() - new Date(lastClosed.closedAt).getTime()) / 60000;
      const cooldown = config.strategy.entry.cooldownMin || 0;
      if (minutesSince < cooldown) {
        console.log(
          `⏸️ ${symbol}: cooldown ${cooldown}m, залишилось ${(cooldown - minutesSince).toFixed(1)}m`,
        );
        return;
      }
    }
  }

  if (!analysisHistory || analysisHistory.length < lookback) {
    console.log(`⚠️ ${symbol}: skip, not enough analyses (need ${lookback})`);
    return;
  }

  // --- 1. Беремо останні аналізи ---
  const lastAnalyses = analysisHistory.reverse();
  const decisions = lastAnalyses.map((a) => a.bias);

  // --- 2. Визначаємо більшість ---
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

  // --- 3. Перевіряємо останній аналіз ---
  const analysis = lastAnalyses[lastAnalyses.length - 1];

  if (analysis.bias !== majority) {
    console.log(
      `⚠️ ${symbol}: skip, last analysis bias ${analysis.bias} ≠ majority ${majority}`,
    );
    return;
  }

  const { entry, capital } = config.strategy;
  const { scores, modules, coverage } = analysis;

  // --- 3a. Мінімальні скор / модулі ---
  const minScore = entry.minScore[majority];
  if (scores[majority] < minScore) {
    console.log(
      `⚠️ ${symbol}: skip, score ${scores[majority]} < minScore ${minScore}`,
    );
    return;
  }

  if (coverage) {
    const [filled, total] = coverage.split('/').map(Number);
    if (filled < entry.minModules) {
      console.log(
        `⚠️ ${symbol}: skip, only ${filled} modules < min ${entry.minModules}`,
      );
      return;
    }
  }

  if (entry.requiredModules?.length) {
    for (const req of entry.requiredModules) {
      if (!modules[req] || (modules[req].signal ?? 'NEUTRAL') === 'NEUTRAL') {
        console.log(`⚠️ ${symbol}: skip, required module ${req} not confirmed`);
        return;
      }
    }
  }

  // --- 3b. Side bias tolerance ---
  const diff = Math.abs(scores.LONG - scores.SHORT);
  if (diff < entry.sideBiasTolerance) {
    console.log(
      `⚠️ ${symbol}: skip, bias difference ${diff} < tolerance ${entry.sideBiasTolerance}`,
    );
    return;
  }

  // --- 3c. Фільтр волатильності ---
  if (modules?.volatility?.status === 'DEAD') {
    console.log(`⚠️ ${symbol}: skip, market DEAD (low volatility)`);
    return;
  }
  if (modules?.volatility?.status === 'EXTREME') {
    console.log(`⚠️ ${symbol}: EXTREME volatility, reducing risk`);
    capital.riskPerTradePct = capital.riskPerTradePct / 2;
  }

  // --- 3d. Перевірка spread ---
  if (
    modules?.liquidity?.spreadPct &&
    modules.liquidity.spreadPct > entry.maxSpreadPct
  ) {
    console.log(
      `⚠️ ${symbol}: skip, spread ${modules.liquidity.spreadPct}% > max ${entry.maxSpreadPct}%`,
    );
    return;
  }

  // --- 3e. Перевірка funding ---
  if (modules?.funding?.fundingRate) {
    const fr = modules.funding.fundingRate;
    const absOver = entry.avoidWhen?.fundingExtreme?.absOver || null;
    if (absOver && Math.abs(fr) > absOver) {
      console.log(`⚠️ ${symbol}: skip, funding extreme ${fr}`);
      return;
    }
  }

  // --- 4. Перевірка по старшому ТФ (легка версія) ---
  const mainTF = config.analysisConfig.candleTimeframe || '1m';
  const higherTF = getHigherTF(mainTF);

  if (higherTF) {
    const raw = await loadDocs('candles', symbol, 500);
    const candles = aggregateCandles(raw, higherTF);

    const higherTrend = await analyzeCandles(symbol, candles);
    const higherVol = await analyzeVolatility(symbol, candles, 14);

    if (!higherTrend || !higherVol) {
      console.log(`⚠️ ${symbol}: skip, no higher TF data (${higherTF})`);
      return;
    }

    if (higherTrend.signal !== majority) {
      console.log(
        `⚠️ ${symbol}: skip, higher TF ${higherTF} conflict (signal ${higherTrend.signal})`,
      );
      return;
    }

    if (higherVol.status === 'DEAD') {
      console.log(`⚠️ ${symbol}: skip, higher TF ${higherTF} DEAD`);
      return;
    }
  }

  // --- 5. Розрахунок розміру угоди ---
  const size = calculatePositionSize({
    ...capital,
    baseSizeUsd: config.strategy.sizing.baseSizeUsd,
    maxPositionUsd: config.strategy.sizing.maxPositionUsd,
  });

  // --- 6. Готуємо повну позицію ---
  const position = await preparePosition(
    symbol,
    config,
    analysis,
    majority,
    size,
  );

  await addPosition(position);
  console.log('🟢 New position opened:', position);
}
