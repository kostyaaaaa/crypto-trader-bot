// trading/core/engine.ts
import type {
  IAnalysis,
  IAnalysisConfig,
  IAnalysisModules,
  ICoinConfig,
  IStrategyConfig,
  ITakeProfit,
} from 'crypto-trader-db';
import { loadDocs } from '../../storage/storage.ts';
import logger from '../../utils/db-logger.ts';
import { notifyTrade } from '../../utils/notify.ts';
import { executeTrade } from '../binance/utils/index.ts';
import { getActivePositions } from './binance-positions-manager.ts';
import cooldownHub from './cooldown-hub.ts';
import { openPosition } from './historyStore.ts';
import markPriceHub from './mark-price-hub.ts';
type Side = 'LONG' | 'SHORT';
type Bias = Side | 'NEUTRAL';
type ModuleKey = keyof IAnalysisModules;

// ---------- helpers ----------
async function getRealtimeMark(symbol: string): Promise<number | null> {
  const m = markPriceHub.getMark(symbol);
  if (m && !m.stale) return Number(m.markPrice);
  const first = await markPriceHub.waitForMark(symbol);
  return first?.markPrice ?? null;
}
export interface TradingEngineArgs {
  symbol: string;
  analysisConfig: IAnalysisConfig;
  strategy: IStrategyConfig;
}
// ---------- main ----------
export async function tradingEngine({
  symbol = 'ETHUSDT',
  analysisConfig,
  strategy,
}: TradingEngineArgs): Promise<void> {
  if (!cooldownHub.isStarted()) cooldownHub.start();

  const lookback = strategy?.entry?.lookback || 3;
  const analysisHistory = (await loadDocs('analysis', symbol, lookback)) as
    | IAnalysis[]
    | null;
  const entryPrice = await getRealtimeMark(symbol);

  const activePositions = await getActivePositions(symbol);
  if (activePositions.length > 0) {
    logger.info(`⏸️ ${symbol}: skip, active positions exist`);
    return;
  }

  // 1) cooldown через CooldownHub (income REALIZED_PNL)
  const cooldownMin = Number(strategy?.entry?.cooldownMin ?? 0);
  if (cooldownMin > 0) {
    const lastClosed = cooldownHub.getLastClosedAt(symbol);
    if (lastClosed) {
      const minutesSince = (Date.now() - lastClosed.getTime()) / 60000;
      if (minutesSince < cooldownMin) {
        logger.info(
          `⏸️ ${symbol}: cooldown ${cooldownMin}m, залишилось ${(
            cooldownMin - minutesSince
          ).toFixed(1)}m`,
        );
        return;
      }
    }
  }

  if (!analysisHistory || analysisHistory.length < lookback) return;

  const lastAnalyses = [...analysisHistory].reverse();
  const analysis = lastAnalyses.at(-1)!;
  const decisions = lastAnalyses.map((a) => a.bias);

  // строгий majority: > floor(n/2), інакше NEUTRAL; tie-break — остання по часу
  function majorityVoteStrict(list: Bias[]): Bias {
    if (!Array.isArray(list) || list.length === 0) return 'NEUTRAL';
    const counts = list.reduce<Record<string, number>>((acc, v) => {
      acc[v] = (acc[v] || 0) + 1;
      return acc;
    }, {});
    let best: Bias = 'NEUTRAL';
    let bestCount = 0;
    for (const [k, c] of Object.entries(counts)) {
      if (c > bestCount) {
        best = k as Bias;
        bestCount = c;
      } else if (c === bestCount) {
        if (list.lastIndexOf(k as Bias) > list.lastIndexOf(best))
          best = k as Bias;
      }
    }
    return bestCount > Math.floor(list.length / 2) ? best : 'NEUTRAL';
  }

  const majority = majorityVoteStrict(decisions as Bias[]);
  if (majority === 'NEUTRAL') {
    logger.info(`⚠️ ${symbol}: skip, majority is NEUTRAL`);
    return;
  }
  if (analysis.bias !== majority) {
    logger.info(`⏸️ ${symbol}: skip, analysis.bias !== majority`);
    return;
  }

  const entry = strategy.entry;
  const required = Array.isArray(strategy?.entry?.requiredModules)
    ? (strategy.entry.requiredModules as string[])
    : [];
  // ризик — не мутуємо оригінал конфіга
  const baseRiskPct = Number(strategy.capital.riskPerTradePct ?? 0);
  let riskFactor = 1;

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
  function isModuleKey(k: string): k is ModuleKey {
    return k in modules;
  }

  if (required.length) {
    for (const req of required) {
      if (!isModuleKey(req)) continue;
      const m = modules[req];
      if (!m || (m?.signal ?? 'NEUTRAL') === 'NEUTRAL') {
        logger.info(`ℹ️ ${symbol}: skip, required module ${req} not satisfied`);
        return;
      }
    }
  }

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

  // волатильність
  const vol = modules?.volatility;
  if (vol) {
    const vSignal = vol.signal;
    const regime = vol.meta?.regime as string | undefined;
    if (vSignal === 'NONE' && regime === 'DEAD') {
      logger.info(`⏸️ ${symbol}: skip, volatility regime DEAD`);
      return;
    }
    if (vSignal === 'NONE' && regime === 'EXTREME') {
      logger.info(`⏸️ ${symbol}: skip, volatility EXTREME`);
      return;
    }
  }

  // спред
  const spreadPct = Number(modules?.liquidity?.meta?.spreadPct ?? 0);
  if (Number.isFinite(spreadPct) && spreadPct > entry.maxSpreadPct) {
    logger.info(
      `⏸️ ${symbol}: skip, spread ${spreadPct} > maxSpreadPct ${entry.maxSpreadPct}`,
    );
    return;
  }

  // funding extreme
  const fr = Number(modules?.funding?.meta?.avgFunding ?? 0);
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

  const runConfig: ICoinConfig = JSON.parse(
    JSON.stringify({ ...strategy, ...analysisConfig }),
  );
  runConfig.strategy.capital.riskPerTradePct = baseRiskPct * riskFactor;
  logger.info(
    `[RISK] ${symbol} base=${baseRiskPct}% × factor=${riskFactor} → effective=${runConfig.strategy.capital.riskPerTradePct}%`,
  );

  let position: any;

  position = await executeTrade(
    symbol,
    runConfig as any,
    analysis,
    majority,
    entryPrice,
  );
  if (position) {
    notifyTrade(position, 'OPENED');
    await openPosition(symbol, {
      side: position.side, // 'LONG' | 'SHORT'
      entryPrice: position.entryPrice,
      size: position.size,
      stopPrice: position.stopPrice ?? null, // ✅ правильний ключ + властивість
      // знімемо можливі зайві поля (pct тощо)
      takeProfits: (position.takeProfits || []).map((tp: ITakeProfit) => ({
        price: Number(tp.price),
        sizePct: Number(tp.sizePct),
        filled: Boolean(tp.filled ?? false),
      })),
      trailingCfg: runConfig.strategy?.exits?.trailing ?? null,
      analysis,
      strategyMeta: {
        leverage: runConfig.strategy.capital?.leverage ?? null,
        riskPct: runConfig.strategy.capital?.riskPerTradePct ?? null,
        strategyName: null,
      },
    });
  }
}
