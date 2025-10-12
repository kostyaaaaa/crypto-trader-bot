import type {
  IAnalysis,
  IAnalysisModules,
  IStrategyConfig,
} from 'crypto-trader-db';
import logger from '../../../utils/db-logger';

type Side = 'LONG' | 'SHORT';
type Bias = Side | 'NEUTRAL';
type ModuleKey = keyof IAnalysisModules;

interface ValidationContext {
  symbol: string;
  analysis: IAnalysis;
  majority: Bias;
  strategy: IStrategyConfig;
}

function isModuleKey(k: string): k is ModuleKey {
  const modules = {} as IAnalysisModules;
  return k in modules;
}

/**
 * Validates minimum score requirement
 */
export function validateMinScore(ctx: ValidationContext): boolean {
  const { symbol, analysis, majority, strategy } = ctx;
  const { scores } = analysis;

  // Skip if NEUTRAL (no min score for NEUTRAL)
  if (majority === 'NEUTRAL') return true;

  const minScore = strategy.entry.minScore[majority];

  if (scores[majority] < minScore) {
    logger.info(
      `⏸️ ${symbol}: skip, score ${scores[majority]} < minScore ${minScore}`,
    );
    return false;
  }
  return true;
}

/**
 * Validates minimum module coverage
 */
export function validateCoverage(ctx: ValidationContext): boolean {
  const { symbol, analysis, strategy } = ctx;
  const { coverage } = analysis;

  if (coverage) {
    const [filled] = coverage.split('/').map(Number);
    if (filled < strategy.entry.minModules) {
      logger.info(
        `⏸️ ${symbol}: skip, coverage ${filled} < minModules ${strategy.entry.minModules}`,
      );
      return false;
    }
  }
  return true;
}

/**
 * Validates required modules are satisfied
 */
export function validateRequiredModules(ctx: ValidationContext): boolean {
  const { symbol, analysis, strategy } = ctx;
  const { modules } = analysis;

  const required = Array.isArray(strategy?.entry?.requiredModules)
    ? (strategy.entry.requiredModules as string[])
    : [];

  if (required.length) {
    for (const req of required) {
      if (!isModuleKey(req)) continue;
      const m = modules[req];
      if (!m || (m?.signal ?? 'NEUTRAL') === 'NEUTRAL') {
        logger.info(`ℹ️ ${symbol}: skip, required module ${req} not satisfied`);
        return false;
      }
    }
  }
  return true;
}

/**
 * Validates higherMA module matches majority
 */
export function validateHigherMA(ctx: ValidationContext): boolean {
  const { symbol, analysis, majority, strategy } = ctx;
  const { modules } = analysis;

  const required = Array.isArray(strategy?.entry?.requiredModules)
    ? (strategy.entry.requiredModules as string[])
    : [];

  if (required.includes('higherMA')) {
    const hmSignal = modules?.higherMA?.signal || 'NEUTRAL';
    if (hmSignal !== majority) {
      logger.info(
        `⏸️ ${symbol}: skip, higherMA(${hmSignal}) ≠ majority(${majority})`,
      );
      return false;
    }
  }
  return true;
}

/**
 * Validates side bias tolerance
 */
export function validateSideBias(ctx: ValidationContext): boolean {
  const { symbol, analysis, strategy } = ctx;
  const { scores } = analysis;

  const diff = Math.abs(scores.LONG - scores.SHORT);
  if (diff < strategy.entry.sideBiasTolerance) {
    logger.info(
      `⏸️ ${symbol}: skip, side bias diff ${diff} < tolerance ${strategy.entry.sideBiasTolerance}`,
    );
    return false;
  }
  return true;
}

/**
 * Validates volatility is acceptable
 */
export function validateVolatility(ctx: ValidationContext): boolean {
  const { symbol, analysis } = ctx;
  const { modules } = analysis;

  const vol = modules?.volatility;
  if (vol) {
    const vSignal = vol.signal;
    const regime = vol.meta?.regime as string | undefined;

    if (vSignal === 'NONE' && regime === 'DEAD') {
      logger.info(`⏸️ ${symbol}: skip, volatility regime DEAD`);
      return false;
    }
    if (vSignal === 'NONE' && regime === 'EXTREME') {
      logger.info(`⏸️ ${symbol}: skip, volatility EXTREME`);
      return false;
    }
  }
  return true;
}

/**
 * Validates spread is within acceptable limits
 */
export function validateSpread(ctx: ValidationContext): boolean {
  const { symbol, analysis, strategy } = ctx;
  const { modules } = analysis;

  const spreadPct = Number(modules?.liquidity?.meta?.spreadPct ?? 0);
  if (Number.isFinite(spreadPct) && spreadPct > strategy.entry.maxSpreadPct) {
    logger.info(
      `⏸️ ${symbol}: skip, spread ${spreadPct} > maxSpreadPct ${strategy.entry.maxSpreadPct}`,
    );
    return false;
  }
  return true;
}

/**
 * Runs all entry validators
 * @returns true if all validations pass, false otherwise
 */
export function validateEntry(ctx: ValidationContext): boolean {
  const validators = [
    validateMinScore,
    validateCoverage,
    validateRequiredModules,
    validateHigherMA,
    validateSideBias,
    validateVolatility,
    validateSpread,
  ];

  for (const validator of validators) {
    if (!validator(ctx)) {
      return false;
    }
  }

  // Log ADX regime info (not a blocker)
  const { symbol, analysis } = ctx;
  if (
    !analysis.modules?.trendRegime ||
    analysis.modules.trendRegime.signal === 'NEUTRAL'
  ) {
    logger.info(`ℹ️ ${symbol}: ADX regime NEUTRAL (no trend)`);
  }

  return true;
}
