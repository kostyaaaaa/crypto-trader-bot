import {
  Checkbox,
  Group,
  NumberInput,
  Select,
  Tabs,
  TagsInput,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { Info } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { type FC } from 'react';
import {
  Controller,
  type Control,
  type Path,
  type UseFormRegister,
} from 'react-hook-form';
import { TIPS } from '../../constants/tooltips';
import type { TCoinConfig } from '../../types';
import styles from './CoinConfigTemplate.module.scss';
import { tabs } from './config';
import useCoinConfigTemplate from './useCoinConfigTemplate';
type TabItem = { value: string; label: string; group: string };

function getTip(name: string): string | undefined {
  const normalized = name.replace(/\[(\d+)\]/g, '.$1').replace(/\.$/, '');
  if (TIPS[normalized]) return TIPS[normalized];

  const noIndex = normalized.replace(/\.\d+$/, '');
  return TIPS[noIndex];
}
function LabelWithTip({
  children,
  tip,
  w = 260,
}: {
  children: ReactNode;
  tip: ReactNode;
  w?: number;
}) {
  return (
    <Group gap={6} align="center" wrap="nowrap">
      <span>{children}</span>
      <Tooltip label={tip} multiline w={w} withArrow>
        <Info size={14} />
      </Tooltip>
    </Group>
  );
}
const FormField = ({
  name,
  label,
  type,
  register,
  control,
  disabledSymbol,
  options,
}: {
  name: Path<TCoinConfig>;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'array';
  register: UseFormRegister<TCoinConfig>;
  control: Control<TCoinConfig>;
  disabledSymbol?: boolean;
  options?: string[];
}) => {
  if (type === 'boolean') {
    return (
      <Checkbox
        className={styles.wrapper__checkbox}
        label={<LabelWithTip tip={getTip(name) ?? '—'}>{label}</LabelWithTip>}
        disabled={disabledSymbol}
        {...register(name)}
      />
    );
  }

  if (type === 'number') {
    return (
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <NumberInput
            className={styles.wrapper__input}
            label={
              <LabelWithTip tip={getTip(name) ?? '—'}>{label}</LabelWithTip>
            }
            value={field.value as number}
            onChange={(value) => field.onChange(value)}
            onBlur={field.onBlur}
            disabled={disabledSymbol}
          />
        )}
      />
    );
  }

  if (type === 'select' && options) {
    return (
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <Select
            className={styles.wrapper__input}
            label={
              <LabelWithTip tip={getTip(name) ?? '—'}>{label}</LabelWithTip>
            }
            data={options}
            value={field.value as string}
            onChange={(value) => field.onChange(value)}
            onBlur={field.onBlur}
            disabled={disabledSymbol}
          />
        )}
      />
    );
  }

  if (type === 'array') {
    return (
      <Controller
        name={name}
        control={control}
        render={({ field }) => {
          const arrayValue = field.value as number[] | string[];
          const stringValue = Array.isArray(arrayValue)
            ? arrayValue.join(', ')
            : '';

          return (
            <TagsInput
              className={styles.wrapper__input}
              label={
                <LabelWithTip tip={getTip(name) ?? '—'}>{label}</LabelWithTip>
              }
              value={stringValue ? stringValue.split(', ') : []}
              onChange={(tags) => {
                // Convert string tags to numbers if they're numeric
                const convertedValues = tags.map((tag) => {
                  const num = parseFloat(tag.trim());
                  return isNaN(num) ? tag.trim() : num;
                });
                field.onChange(convertedValues);
              }}
              onBlur={field.onBlur}
              disabled={disabledSymbol}
              placeholder="Enter values separated by commas"
              splitChars={[',', ' ']}
              data={options || []}
            />
          );
        }}
      />
    );
  }

  return (
    <TextInput
      className={styles.wrapper__input}
      label={<LabelWithTip tip={getTip(name) ?? '—'}>{label}</LabelWithTip>}
      {...register(name)}
    />
  );
};

const CoinConfigTemplate: FC<ICoinConfigTemplateProps> = ({
  register,
  control,
}) => {
  const { activeTab, setActiveTab } = useCoinConfigTemplate();
  const groupedTabs = (tabs as TabItem[]).reduce<Record<string, TabItem[]>>(
    (acc, t) => {
      (acc[t.group] ??= []).push(t);
      return acc;
    },
    {},
  );

  return (
    <>
      <Tabs
        className={`${styles.wrapper__tabs}`}
        defaultValue="anal_config"
        value={activeTab}
        onChange={setActiveTab}
        orientation="vertical"
      >
        <Tabs.List className={styles.wrapper__tabsList}>
          {Object.entries(groupedTabs).flatMap(([groupTitle, items]) => [
            <Tabs.Tab
              key={`__group__${groupTitle}`}
              value={`__group__${groupTitle}`}
              disabled
              className={styles.wrapper__groupTitle}
            >
              {groupTitle}
            </Tabs.Tab>,
            ...items.map((it) => (
              <Tabs.Tab key={it.value} value={it.value}>
                {it.label}
              </Tabs.Tab>
            )),
          ])}
        </Tabs.List>

        {/* Analysis Config */}
        <Tabs.Panel value="anal_config">
          <div className={styles['wrapper__form-list']}>
            <FormField
              name="analysisConfig.candleTimeframe"
              label="Candle Timeframe"
              type="string"
              register={register}
              control={control}
            />
            <FormField
              name="analysisConfig.oiWindow"
              label="OI Window"
              type="number"
              register={register}
              control={control}
            />
            <FormField
              name="analysisConfig.liqWindow"
              label="Liq Window"
              type="number"
              register={register}
              control={control}
            />
            <FormField
              name="analysisConfig.volWindow"
              label="Vol Window"
              type="number"
              register={register}
              control={control}
            />
            <FormField
              name="analysisConfig.corrWindow"
              label="Corr Window"
              type="number"
              register={register}
              control={control}
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
                control={control}
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
                control={control}
              />
            ))}
          </div>
        </Tabs.Panel>

        {/* Module higherMA */}
        <Tabs.Panel value="anal_module_higherMA">
          <div className={styles['wrapper__form-list']}>
            <FormField
              name="analysisConfig.higherMA.timeframe"
              label="HigherMA Timeframe"
              type="select"
              register={register}
              control={control}
              options={['1d', '4h', '1w', '1h']}
            />
            <FormField
              name="analysisConfig.higherMA.maShort"
              label="HigherMA Short Period"
              type="number"
              register={register}
              control={control}
            />
            <FormField
              name="analysisConfig.higherMA.maLong"
              label="HigherMA Long Period"
              type="number"
              register={register}
              control={control}
            />
            <FormField
              name="analysisConfig.higherMA.type"
              label="HigherMA Type"
              type="select"
              register={register}
              control={control}
              options={['SMA', 'EMA']}
            />
            <FormField
              name="analysisConfig.higherMA.thresholdPct"
              label="HigherMA Threshold %"
              type="number"
              register={register}
              control={control}
            />
            <FormField
              name="analysisConfig.higherMA.scale"
              label="HigherMA Scale"
              type="number"
              register={register}
              control={control}
            />
            <FormField
              name="analysisConfig.higherMA.emaSeed"
              label="EMA Seed"
              type="select"
              register={register}
              control={control}
              options={['sma', 'first']}
            />
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
              control={control}
            />
            <FormField
              name="strategy.entry.minScore.SHORT"
              label="Entry MinScore SHORT"
              type="number"
              register={register}
              control={control}
            />
            <FormField
              name="strategy.entry.minModules"
              label="Min Modules"
              type="number"
              register={register}
              control={control}
            />
            <FormField
              name="strategy.entry.requiredModules"
              label="Required Modules"
              type="array"
              register={register}
              control={control}
              options={[...moduleKeys]}
            />
            <FormField
              name="strategy.entry.maxSpreadPct"
              label="Max Spread Pct"
              type="number"
              register={register}
              control={control}
            />
            <FormField
              name="strategy.entry.cooldownMin"
              label="Cooldown Min"
              type="number"
              register={register}
              control={control}
            />
            <FormField
              name="strategy.entry.lookback"
              label="Lookback"
              type="number"
              register={register}
              control={control}
            />
            <FormField
              name="strategy.entry.sideBiasTolerance"
              label="Side Bias Tolerance"
              type="number"
              register={register}
              control={control}
            />
            <FormField
              name="strategy.entry.avoidWhen.volatility"
              label="Avoid Volatility"
              type="string"
              register={register}
              control={control}
            />
          </div>
        </Tabs.Panel>

        {/* Strategy Volatility Filter */}
        <Tabs.Panel value="strategy_volatility_filter">
          <div className={styles['wrapper__form-list']}>
            <FormField
              name="strategy.volatilityFilter.minThreshold"
              label="Min Threshold"
              type="number"
              register={register}
              control={control}
            />
            <FormField
              name="strategy.volatilityFilter.maxThreshold"
              label="Max Threshold"
              type="number"
              register={register}
              control={control}
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
              control={control}
            />
            <FormField
              name="strategy.capital.riskPerTradePct"
              label="Risk Per Trade %"
              type="number"
              register={register}
              control={control}
            />
            <FormField
              name="strategy.capital.leverage"
              label="Leverage"
              type="number"
              register={register}
              control={control}
            />
            <FormField
              name="strategy.capital.maxConcurrentPositions"
              label="Max Concurrent Positions"
              type="number"
              register={register}
              control={control}
            />
          </div>
        </Tabs.Panel>

        {/* Strategy Sizing */}
        <Tabs.Panel value="strategy_sizing">
          <div className={styles['wrapper__form-list']}>
            <FormField
              name="strategy.sizing.maxAdds"
              label="Max Adds"
              type="number"
              register={register}
              control={control}
            />
            <FormField
              name="strategy.sizing.addOnAdverseMovePct"
              label="Add On Adverse Move %"
              type="number"
              register={register}
              control={control}
            />
            <FormField
              name="strategy.sizing.addMultiplier"
              label="Add Multiplier"
              type="number"
              register={register}
              control={control}
            />
          </div>
        </Tabs.Panel>

        {/* Strategy Exits Opposite Count */}
        <Tabs.Panel value="strategy_exits_opposite_count_exit">
          <div className={styles['wrapper__form-list']}>
            <FormField
              name="strategy.exits.oppositeCountExit"
              label="Opposite Count Exit"
              type="number"
              register={register}
              control={control}
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
              control={control}
            />
            <FormField
              name="strategy.exits.tp.tpGridPct"
              label="TP Grid Percentages"
              type="array"
              register={register}
              control={control}
            />
            <FormField
              name="strategy.exits.tp.tpGridSizePct"
              label="TP Grid Size Percentages"
              type="array"
              register={register}
              control={control}
            />
          </div>
        </Tabs.Panel>

        {/* Strategy Exits Stop Loss */}
        <Tabs.Panel value="strategy_exits_stop_loss">
          <div className={styles['wrapper__form-list']}>
            <FormField
              name="strategy.exits.sl.type"
              label="SL Type"
              type="select"
              register={register}
              control={control}
              options={['atr', 'hard']}
            />
            <FormField
              name="strategy.exits.sl.hardPct"
              label="SL Hard Pct"
              type="number"
              register={register}
              control={control}
            />
            <FormField
              name="strategy.exits.sl.atrMult"
              label="SL ATR Mult"
              type="number"
              register={register}
              control={control}
            />
            <FormField
              name="strategy.exits.sl.signalRules.flipIf.scoreGap"
              label="SL FlipIf ScoreGap"
              type="number"
              register={register}
              control={control}
            />
            <FormField
              name="strategy.exits.sl.signalRules.flipIf.minOppScore"
              label="SL FlipIf MinOppScore"
              type="number"
              register={register}
              control={control}
            />
            <FormField
              name="strategy.exits.sl.signalRules.moduleFail.required"
              label="SL ModuleFail Required Modules"
              type="array"
              register={register}
              control={control}
              options={[...moduleKeys]}
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
              control={control}
            />
            <FormField
              name="strategy.exits.time.noPnLFallback"
              label="NoPnL Fallback"
              type="select"
              register={register}
              control={control}
              options={['none', 'breakeven', 'closeSmallLoss']}
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
              control={control}
            />
            <FormField
              name="strategy.exits.trailing.startAfterPct"
              label="Start After Pct"
              type="number"
              register={register}
              control={control}
            />
            <FormField
              name="strategy.exits.trailing.trailStepPct"
              label="Trail Step Pct"
              type="number"
              register={register}
              control={control}
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
  control: Control<TCoinConfig, unknown, TCoinConfig>;
}

const moduleKeys = [
  'trend',
  'trendRegime',
  'liquidity',
  'openInterest',
  'higherMA',
  'rsiVolTrend',
] as const;
