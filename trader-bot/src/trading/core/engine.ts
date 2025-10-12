// trading/core/engine.ts
import type {
  IAnalysis,
  IAnalysisConfig,
  ICoinConfig,
  IStrategyConfig,
  ITakeProfit,
} from 'crypto-trader-db';
import { getAnalysis } from '../../api';
import logger from '../../utils/db-logger';
import { notifyTrade } from '../../utils/notify';
import { executeTrade } from '../binance/utils/index';
import { getActivePositions } from './binance-positions-manager';
import cooldownHub from './cooldown-hub';
import { getRealtimeMark } from './helpers/mark-price-helper';
import { majorityVoteStrict } from './helpers/voting';
import { openPosition } from './history-store';
import { validateEntry } from './validators/entry-validators';

type Side = 'LONG' | 'SHORT';
type Bias = Side | 'NEUTRAL';
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
  const analysisHistory = (await getAnalysis(symbol, lookback)) as
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

  const majority = majorityVoteStrict(decisions as Bias[]);
  if (majority === 'NEUTRAL') {
    logger.info(`⚠️ ${symbol}: skip, majority is NEUTRAL`);
    return;
  }
  if (analysis.bias !== majority) {
    logger.info(`⏸️ ${symbol}: skip, analysis.bias !== majority`);
    return;
  }

  // Validate all entry conditions
  const validationContext = { symbol, analysis, majority, strategy };
  if (!validateEntry(validationContext)) {
    return;
  }

  // ризик — не мутуємо оригінал конфіга
  const baseRiskPct = Number(strategy.capital.riskPerTradePct ?? 0);
  const riskFactor = 1;

  if (entryPrice == null || !Number.isFinite(entryPrice)) {
    logger.warn(`⚠️ ${symbol}: skip, no fresh mark price available`);
    return;
  }

  const runConfig: ICoinConfig = JSON.parse(
    JSON.stringify({ strategy, analysisConfig }),
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
    notifyTrade(position, 'OPEN');
    await openPosition(symbol, {
      side: position.side, // 'LONG' | 'SHORT'
      entryPrice: position.entryPrice,
      size: position.size,
      stopPrice: position.stopPrice ?? null,
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
