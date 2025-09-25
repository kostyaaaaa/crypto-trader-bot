import { type FC } from 'react';
import styles from './CoinConfigTemplate.module.scss';
import { TextInput } from '@mantine/core';
import type { UseFormRegister } from 'react-hook-form';
import type { TCoinConfig } from '../../types';

const CoinConfigTemplate: FC<ICoinConfigTemplateProps> = ({
  onSubmit,
  register,
  disabledSymbol,
}) => {
  return (
    <form className={styles.wrapper__form} onSubmit={onSubmit}>
      {/* SYMBOL */}
      <TextInput
        className={styles.wrapper__input}
        label="Symbol"
        disabled={disabledSymbol}
        {...register('symbol')}
      />
      {/* ANALYSIS CONFIG */}
      <h4>Analysis Config</h4>
      <div className={styles['wrapper__form-list']}>
        <TextInput
          className={styles.wrapper__input}
          label="Candle Timeframe"
          {...register('analysisConfig.candleTimeframe')}
        />
        <TextInput
          className={styles.wrapper__input}
          label="OI Window"
          {...register('analysisConfig.oiWindow')}
        />
        <TextInput
          className={styles.wrapper__input}
          label="Liq Window"
          {...register('analysisConfig.liqWindow')}
        />
        <TextInput
          className={styles.wrapper__input}
          label="Liq Sent Window"
          {...register('analysisConfig.liqSentWindow')}
        />
        <TextInput
          className={styles.wrapper__input}
          label="Funding Window"
          {...register('analysisConfig.fundingWindow')}
        />
        <TextInput
          className={styles.wrapper__input}
          label="Vol Window"
          {...register('analysisConfig.volWindow')}
        />
        <TextInput
          className={styles.wrapper__input}
          label="Corr Window"
          {...register('analysisConfig.corrWindow')}
        />
        <TextInput
          className={styles.wrapper__input}
          label="LongShort Window"
          {...register('analysisConfig.longShortWindow')}
        />
      </div>
      <h5>Weights</h5>
      <div className={styles['wrapper__form-list']}>
        {moduleKeys.map((key) => (
          <TextInput
            className={styles.wrapper__input}
            key={key}
            label={key}
            {...register(`analysisConfig.weights.${key}` as const)}
          />
        ))}
      </div>
      <h5>Module Thresholds</h5>
      <div className={styles['wrapper__form-list']}>
        {moduleKeys.map((key) => (
          <TextInput
            className={styles.wrapper__input}
            key={key}
            label={key}
            {...register(`analysisConfig.moduleThresholds.${key}` as const)}
          />
        ))}
      </div>
      {/* STRATEGY */}
      <h4>Strategy</h4>
      {/* ENTRY */}
      <h5>Entry</h5>
      <div className={styles['wrapper__form-list']}>
        <TextInput
          className={styles.wrapper__input}
          label="Entry MinScore LONG"
          {...register('strategy.entry.minScore.LONG')}
        />
        <TextInput
          className={styles.wrapper__input}
          label="Entry MinScore SHORT"
          {...register('strategy.entry.minScore.SHORT')}
        />
        <TextInput
          className={styles.wrapper__input}
          label="Min Modules"
          {...register('strategy.entry.minModules')}
        />
        <TextInput
          className={styles.wrapper__input}
          label="Required Modules (comma separated)"
          {...register('strategy.entry.requiredModules.0')}
        />
        <TextInput
          className={styles.wrapper__input}
          label="Max Spread Pct"
          {...register('strategy.entry.maxSpreadPct')}
        />
        <TextInput
          className={styles.wrapper__input}
          label="Cooldown Min"
          {...register('strategy.entry.cooldownMin')}
        />
        <TextInput
          className={styles.wrapper__input}
          label="Side Bias Tolerance"
          {...register('strategy.entry.sideBiasTolerance')}
        />
        <TextInput
          className={styles.wrapper__input}
          label="Avoid Volatility"
          {...register('strategy.entry.avoidWhen.volatility')}
        />
        <TextInput
          className={styles.wrapper__input}
          label="Avoid FundingExtreme AbsOver"
          {...register('strategy.entry.avoidWhen.fundingExtreme.absOver')}
        />
      </div>
      {/* VOLATILITY FILTER */}
      <h5>Volatility Filter</h5>
      <div className={styles['wrapper__form-list']}>
        <TextInput
          className={styles.wrapper__input}
          label="Dead Below"
          {...register('strategy.volatilityFilter.deadBelow')}
        />
        <TextInput
          className={styles.wrapper__input}
          label="Extreme Above"
          {...register('strategy.volatilityFilter.extremeAbove')}
        />
      </div>
      {/* CAPITAL */}
      <h5>Capital</h5>
      <div className={styles['wrapper__form-list']}>
        <TextInput
          className={styles.wrapper__input}
          label="Account"
          {...register('strategy.capital.account')}
        />
        <TextInput
          className={styles.wrapper__input}
          label="Risk Per Trade %"
          {...register('strategy.capital.riskPerTradePct')}
        />
        <TextInput
          className={styles.wrapper__input}
          label="Leverage"
          {...register('strategy.capital.leverage')}
        />
        <TextInput
          className={styles.wrapper__input}
          label="Max Concurrent Positions"
          {...register('strategy.capital.maxConcurrentPositions')}
        />
      </div>
      {/* SIZING */}
      <h5>Sizing</h5>
      <div className={styles['wrapper__form-list']}>
        <TextInput
          className={styles.wrapper__input}
          label="Max Position USD"
          {...register('strategy.sizing.maxPositionUsd')}
        />
        <TextInput
          className={styles.wrapper__input}
          label="Max Adds"
          {...register('strategy.sizing.maxAdds')}
        />
        <TextInput
          className={styles.wrapper__input}
          label="Add On Adverse Move %"
          {...register('strategy.sizing.addOnAdverseMovePct')}
        />
        <TextInput
          className={styles.wrapper__input}
          label="Add Multiplier"
          {...register('strategy.sizing.addMultiplier')}
        />
        <TextInput
          className={styles.wrapper__input}
          label="Base Size USD"
          {...register('strategy.sizing.baseSizeUsd')}
        />
      </div>
      {/* EXITS */}
      <h5>Exits</h5>
      {/* TP */}
      <h6>Take Profit</h6>{' '}
      <div className={styles['wrapper__form-list']}>
        <TextInput
          className={styles.wrapper__input}
          label="Use TP"
          {...register('strategy.exits.tp.use')}
        />
        <TextInput
          className={styles.wrapper__input}
          label="TP Grid Pct[0]"
          {...register('strategy.exits.tp.tpGridPct.0')}
        />
        <TextInput
          className={styles.wrapper__input}
          label="TP Grid Pct[1]"
          {...register('strategy.exits.tp.tpGridPct.1')}
        />
        <TextInput
          className={styles.wrapper__input}
          label="TP Grid Size Pct[0]"
          {...register('strategy.exits.tp.tpGridSizePct.0')}
        />
        <TextInput
          className={styles.wrapper__input}
          label="TP Grid Size Pct[1]"
          {...register('strategy.exits.tp.tpGridSizePct.1')}
        />
      </div>
      {/* SL */}
      <h6>Stop Loss</h6>
      <div className={styles['wrapper__form-list']}>
        <TextInput
          className={styles.wrapper__input}
          label="SL Type"
          {...register('strategy.exits.sl.type')}
        />
        <TextInput
          className={styles.wrapper__input}
          label="SL Hard Pct"
          {...register('strategy.exits.sl.hardPct')}
        />
        <TextInput
          className={styles.wrapper__input}
          label="SL ATR Mult"
          {...register('strategy.exits.sl.atrMult')}
        />
        <TextInput
          className={styles.wrapper__input}
          label="SL FlipIf ScoreGap"
          {...register('strategy.exits.sl.signalRules.flipIf.scoreGap')}
        />
        <TextInput
          className={styles.wrapper__input}
          label="SL FlipIf MinOppScore"
          {...register('strategy.exits.sl.signalRules.flipIf.minOppScore')}
        />
        <TextInput
          className={styles.wrapper__input}
          label="SL ModuleFail Required[0]"
          {...register('strategy.exits.sl.signalRules.moduleFail.required.0')}
        />
      </div>
      {/* TIME EXIT */}
      <h6>Time Exit</h6>
      <div className={styles['wrapper__form-list']}>
        <TextInput
          className={styles.wrapper__input}
          label="Max Hold Min"
          {...register('strategy.exits.time.maxHoldMin')}
        />
        <TextInput
          className={styles.wrapper__input}
          label="NoPnL Fallback"
          {...register('strategy.exits.time.noPnLFallback')}
        />
      </div>
      {/* TRAILING */}
      <h6>Trailing</h6>
      <div className={styles['wrapper__form-list']}>
        <TextInput
          className={styles.wrapper__input}
          label="Use Trailing"
          {...register('strategy.exits.trailing.use')}
        />
        <TextInput
          className={styles.wrapper__input}
          label="Start After Pct"
          {...register('strategy.exits.trailing.startAfterPct')}
        />
        <TextInput
          className={styles.wrapper__input}
          label="Trail Step Pct"
          {...register('strategy.exits.trailing.trailStepPct')}
        />
      </div>
      <input type="submit" value="Submit Config" />
    </form>
  );
};

export default CoinConfigTemplate;

interface ICoinConfigTemplateProps {
  onSubmit: () => void;
  register: UseFormRegister<TCoinConfig>;
  disabledSymbol?: boolean;
}

const moduleKeys = [
  'trend',
  'trendRegime',
  'liquidity',
  'funding',
  'liquidations',
  'openInterest',
  'correlation',
  'longShort',
] as const;
