import { type FC } from 'react';
import styles from './CoinConfigTemplate.module.scss';
import { Autocomplete, Button, Tabs } from '@mantine/core';
import {
  Controller,
  type Control,
  type Path,
  type UseFormRegister,
} from 'react-hook-form';
import type { TCoinConfig } from '../../types';
import { tabs } from './config';
import { TextInput, Checkbox } from '@mantine/core';
import useCoinConfigTemplate from './useCoinConfigTemplate';

const FormField = ({
  name,
  label,
  type,
  register,
  disabledSymbol,
}: {
  name: Path<TCoinConfig>;
  label: string;
  type: 'string' | 'number' | 'boolean';
  register: UseFormRegister<TCoinConfig>;
  disabledSymbol?: boolean;
}) => {
  if (type === 'boolean') {
    return (
      <Checkbox
        className={styles.wrapper__checkbox}
        label={label}
        disabled={disabledSymbol}
        {...register(name)}
      />
    );
  }

  if (type === 'number') {
    return (
      <TextInput
        className={styles.wrapper__input}
        type="number"
        label={label}
        {...register(name, { valueAsNumber: true })}
        onKeyDown={(e) => {
          if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault();
        }}
      />
    );
  }

  return (
    <TextInput
      className={styles.wrapper__input}
      label={label}
      {...register(name)}
    />
  );
};

const CoinConfigTemplate: FC<ICoinConfigTemplateProps> = ({
  register,
  disabledSymbol,
  control,
}) => {
  const { symbolList, activeTab, setActiveTab } = useCoinConfigTemplate();

  return (
    <>
      <div className={styles.wrapper__title}>
        <Controller
          name="symbol"
          control={control}
          render={({ field }) => (
            <Autocomplete
              {...field}
              label="Symbol"
              placeholder="Pick Symbol"
              data={symbolList}
              clearable
              disabled={disabledSymbol}
            />
          )}
        />

        <Checkbox
          className={styles.wrapper__checkbox}
          label="is active"
          {...register('isActive')}
        />
      </div>

      <Tabs
        className={styles.wrapper__tabs}
        defaultValue="anal_config"
        value={activeTab}
        onChange={setActiveTab}
      >
        <Tabs.List>
          {tabs.map((t) => (
            <Tabs.Tab key={t.value} value={t.value}>
              {t.label}
            </Tabs.Tab>
          ))}
        </Tabs.List>

        {/* Analysis Config */}
        <Tabs.Panel value="anal_config">
          <div className={styles['wrapper__form-list']}>
            <FormField
              name="analysisConfig.candleTimeframe"
              label="Candle Timeframe"
              type="string"
              register={register}
            />
            <FormField
              name="analysisConfig.oiWindow"
              label="OI Window"
              type="number"
              register={register}
            />
            <FormField
              name="analysisConfig.liqWindow"
              label="Liq Window"
              type="number"
              register={register}
            />
            <FormField
              name="analysisConfig.liqSentWindow"
              label="Liq Sent Window"
              type="number"
              register={register}
            />
            <FormField
              name="analysisConfig.fundingWindow"
              label="Funding Window"
              type="number"
              register={register}
            />
            <FormField
              name="analysisConfig.volWindow"
              label="Vol Window"
              type="number"
              register={register}
            />
            <FormField
              name="analysisConfig.corrWindow"
              label="Corr Window"
              type="number"
              register={register}
            />
            <FormField
              name="analysisConfig.longShortWindow"
              label="LongShort Window"
              type="number"
              register={register}
            />
          </div>
        </Tabs.Panel>

        <Tabs.Panel value="anal_weights">
          <div className={styles['wrapper__form-list']}>
            {moduleKeys.map((key) => (
              <FormField
                key={key}
                name={`analysisConfig.weights.${key}`}
                label={key}
                type="number"
                register={register}
              />
            ))}
          </div>
        </Tabs.Panel>

        {/* Module Thresholds */}
        <Tabs.Panel value="anal_module_thresholds">
          <div className={styles['wrapper__form-list']}>
            {moduleKeys.map((key) => (
              <FormField
                key={key}
                name={`analysisConfig.moduleThresholds.${key}`}
                label={key}
                type="number"
                register={register}
              />
            ))}
          </div>
        </Tabs.Panel>

        {/* Strategy Entry */}
        <Tabs.Panel value="strategy_entry">
          <div className={styles['wrapper__form-list']}>
            <FormField
              name="strategy.entry.minScore.LONG"
              label="Entry MinScore LONG"
              type="number"
              register={register}
            />
            <FormField
              name="strategy.entry.minScore.SHORT"
              label="Entry MinScore SHORT"
              type="number"
              register={register}
            />
            <FormField
              name="strategy.entry.minModules"
              label="Min Modules"
              type="number"
              register={register}
            />
            <FormField
              name="strategy.entry.requiredModules.0"
              label="Required Modules (comma separated)"
              type="string"
              register={register}
            />
            <FormField
              name="strategy.entry.maxSpreadPct"
              label="Max Spread Pct"
              type="number"
              register={register}
            />
            <FormField
              name="strategy.entry.cooldownMin"
              label="Cooldown Min"
              type="number"
              register={register}
            />
            <FormField
              name="strategy.entry.sideBiasTolerance"
              label="Side Bias Tolerance"
              type="number"
              register={register}
            />
            <FormField
              name="strategy.entry.avoidWhen.volatility"
              label="Avoid Volatility"
              type="string"
              register={register}
            />
            <FormField
              name="strategy.entry.avoidWhen.fundingExtreme.absOver"
              label="Avoid FundingExtreme AbsOver"
              type="number"
              register={register}
            />
          </div>
        </Tabs.Panel>

        {/* Strategy Volatility Filter */}
        <Tabs.Panel value="strategy_volatility_filter">
          <div className={styles['wrapper__form-list']}>
            <FormField
              name="strategy.volatilityFilter.deadBelow"
              label="Dead Below"
              type="number"
              register={register}
            />
            <FormField
              name="strategy.volatilityFilter.extremeAbove"
              label="Extreme Above"
              type="number"
              register={register}
            />
          </div>
        </Tabs.Panel>

        {/* Strategy Capital */}
        <Tabs.Panel value="strategy_capital">
          <div className={styles['wrapper__form-list']}>
            <FormField
              name="strategy.capital.account"
              label="Account"
              type="number"
              register={register}
            />
            <FormField
              name="strategy.capital.riskPerTradePct"
              label="Risk Per Trade %"
              type="number"
              register={register}
            />
            <FormField
              name="strategy.capital.leverage"
              label="Leverage"
              type="number"
              register={register}
            />
            <FormField
              name="strategy.capital.maxConcurrentPositions"
              label="Max Concurrent Positions"
              type="number"
              register={register}
            />
          </div>
        </Tabs.Panel>

        {/* Strategy Sizing */}
        <Tabs.Panel value="strategy_sizing">
          <div className={styles['wrapper__form-list']}>
            <FormField
              name="strategy.sizing.maxPositionUsd"
              label="Max Position USD"
              type="number"
              register={register}
            />
            <FormField
              name="strategy.sizing.maxAdds"
              label="Max Adds"
              type="number"
              register={register}
            />
            <FormField
              name="strategy.sizing.addOnAdverseMovePct"
              label="Add On Adverse Move %"
              type="number"
              register={register}
            />
            <FormField
              name="strategy.sizing.addMultiplier"
              label="Add Multiplier"
              type="number"
              register={register}
            />
            <FormField
              name="strategy.sizing.baseSizeUsd"
              label="Base Size USD"
              type="number"
              register={register}
            />
          </div>
        </Tabs.Panel>

        {/* Strategy Exits Take Profit */}
        <Tabs.Panel value="strategy_exits_take_profit">
          <div className={styles['wrapper__form-list']}>
            <FormField
              name="strategy.exits.tp.use"
              label="Use TP"
              type="boolean"
              register={register}
            />
            <FormField
              name="strategy.exits.tp.tpGridPct.0"
              label="TP Grid Pct[0]"
              type="number"
              register={register}
            />
            <FormField
              name="strategy.exits.tp.tpGridPct.1"
              label="TP Grid Pct[1]"
              type="number"
              register={register}
            />
            <FormField
              name="strategy.exits.tp.tpGridSizePct.0"
              label="TP Grid Size Pct[0]"
              type="number"
              register={register}
            />
            <FormField
              name="strategy.exits.tp.tpGridSizePct.1"
              label="TP Grid Size Pct[1]"
              type="number"
              register={register}
            />
          </div>
        </Tabs.Panel>

        {/* Strategy Exits Stop Loss */}
        <Tabs.Panel value="strategy_exits_stop_loss">
          <div className={styles['wrapper__form-list']}>
            <FormField
              name="strategy.exits.sl.type"
              label="SL Type"
              type="string"
              register={register}
            />
            <FormField
              name="strategy.exits.sl.hardPct"
              label="SL Hard Pct"
              type="number"
              register={register}
            />
            <FormField
              name="strategy.exits.sl.atrMult"
              label="SL ATR Mult"
              type="number"
              register={register}
            />
            <FormField
              name="strategy.exits.sl.signalRules.flipIf.scoreGap"
              label="SL FlipIf ScoreGap"
              type="number"
              register={register}
            />
            <FormField
              name="strategy.exits.sl.signalRules.flipIf.minOppScore"
              label="SL FlipIf MinOppScore"
              type="number"
              register={register}
            />
            <FormField
              name="strategy.exits.sl.signalRules.moduleFail.required.0"
              label="SL ModuleFail Required[0]"
              type="string"
              register={register}
            />
          </div>
        </Tabs.Panel>

        {/* Strategy Exits Time Exit */}
        <Tabs.Panel value="strategy_exits_time_exit">
          <div className={styles['wrapper__form-list']}>
            <FormField
              name="strategy.exits.time.maxHoldMin"
              label="Max Hold Min"
              type="number"
              register={register}
            />
            <FormField
              name="strategy.exits.time.noPnLFallback"
              label="NoPnL Fallback"
              type="string"
              register={register}
            />
          </div>
        </Tabs.Panel>

        {/* Strategy Exits Trailing */}
        <Tabs.Panel value="strategy_exits_trailing">
          <div className={styles['wrapper__form-list']}>
            <FormField
              name="strategy.exits.trailing.use"
              label="Use Trailing"
              type="boolean"
              register={register}
            />
            <FormField
              name="strategy.exits.trailing.startAfterPct"
              label="Start After Pct"
              type="number"
              register={register}
            />
            <FormField
              name="strategy.exits.trailing.trailStepPct"
              label="Trail Step Pct"
              type="number"
              register={register}
            />
          </div>
        </Tabs.Panel>
      </Tabs>
    </>
  );
};

export default CoinConfigTemplate;

interface ICoinConfigTemplateProps {
  register: UseFormRegister<TCoinConfig>;
  disabledSymbol?: boolean;
  control: Control<TCoinConfig, any, TCoinConfig>;
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
