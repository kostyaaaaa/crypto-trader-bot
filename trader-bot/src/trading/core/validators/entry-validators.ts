import type {
  IAnalysis,
  IAnalysisModules,
  IStrategyConfig,
} from 'crypto-trader-db';
import logger from '../../../utils/db-logger';
import cooldownHub from '../cooldown-hub';

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
 * For scoring modules: check if LONG or SHORT score > 0
 * For validation modules: check if signal is not INACTIVE
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
      if (!m) {
        logger.info(`ℹ️ ${symbol}: skip, required module ${req} is null`);
        return false;
      }

      // Check based on module type
      if (m.type === 'validation') {
        // Validation module: check signal
        if (m.signal === 'INACTIVE') {
          logger.info(`ℹ️ ${symbol}: skip, required module ${req} is INACTIVE`);
          return false;
        }
      } else if (m.type === 'scoring') {
        // Scoring module: check if has any score
        const longScore = Number(m.meta?.LONG) || 0;
        const shortScore = Number(m.meta?.SHORT) || 0;
        if (longScore === 0 && shortScore === 0) {
          logger.info(
            `ℹ️ ${symbol}: skip, required module ${req} has no scores`,
          );
          return false;
        }
      }
    }
  }
  return true;
}

/**
 * Validates higherMA module aligns with majority
 * HigherMA is a scoring module, so we check LONG vs SHORT scores
 */
export function validateHigherMA(ctx: ValidationContext): boolean {
  const { symbol, analysis, majority, strategy } = ctx;
  const { modules } = analysis;

  const required = Array.isArray(strategy?.entry?.requiredModules)
    ? (strategy.entry.requiredModules as string[])
    : [];

  if (required.includes('higherMA') && modules?.higherMA) {
    const longScore = Number(modules.higherMA.meta?.LONG) || 0;
    const shortScore = Number(modules.higherMA.meta?.SHORT) || 0;

    // Determine higherMA direction based on scores
    const hmDirection =
      longScore > shortScore
        ? 'LONG'
        : shortScore > longScore
          ? 'SHORT'
          : 'NEUTRAL';

    if (hmDirection !== majority && hmDirection !== 'NEUTRAL') {
      logger.info(
        `⏸️ ${symbol}: skip, higherMA(${hmDirection}) ≠ majority(${majority})`,
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
 * Volatility is now a validation module returning ACTIVE/NEUTRAL/INACTIVE
 */
export function validateVolatility(ctx: ValidationContext): boolean {
  const { symbol, analysis } = ctx;
  const { modules } = analysis;

  const vol = modules?.volatility;
  if (vol) {
    const vSignal = vol.signal;
    const regime = vol.meta?.regime as string | undefined;

    if (vSignal === 'INACTIVE' && regime === 'DEAD') {
      logger.info(`⏸️ ${symbol}: skip, volatility regime DEAD`);
      return false;
    }
    if (vSignal === 'INACTIVE' && regime === 'EXTREME') {
      logger.info(`⏸️ ${symbol}: skip, volatility EXTREME`);
      return false;
    }
  }
  return true;
}

/**
 * Validates liquidations activity is within acceptable range
 */
export function validateLiquidations(ctx: ValidationContext): boolean {
  const { symbol, analysis } = ctx;
  const { modules } = analysis;

  const liq = modules?.liquidations;
  if (liq && liq.signal === 'INACTIVE') {
    // Trigger 30-minute cooldown for liquidations exceeded threshold
    cooldownHub.addLiquidationsCooldown(symbol);

    logger.info(
      `⏸️ ${symbol}: skip, liquidations INACTIVE (exceeded dynamic threshold)`,
    );
    return false;
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
    validateLiquidations,
    validateSpread,
  ];

  for (const validator of validators) {
    if (!validator(ctx)) {
      return false;
    }
  }

  // Log ADX regime info (not a blocker)
  // TrendRegime is a scoring module - check if scores are low
  const { symbol, analysis } = ctx;
  if (analysis.modules?.trendRegime) {
    const longScore = Number(analysis.modules.trendRegime.meta?.LONG) || 0;
    const shortScore = Number(analysis.modules.trendRegime.meta?.SHORT) || 0;
    if (longScore === 0 && shortScore === 0) {
      logger.info(`ℹ️ ${symbol}: ADX regime weak (no trend detected)`);
    }
  }

  return true;
}
