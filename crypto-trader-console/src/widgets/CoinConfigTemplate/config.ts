export type TabItem = {
  value: string;
  label: string;
  group: 'Analysis' | 'Entry & Capital' | 'Exits';
};

export const tabs: TabItem[] = [
  // Analysis
  { value: 'anal_config', label: 'Analysis Config', group: 'Analysis' },
  { value: 'anal_weights', label: 'Analysis Weights', group: 'Analysis' },
  {
    value: 'anal_module_thresholds',
    label: 'Module Thresholds',
    group: 'Analysis',
  },
  { value: 'anal_module_higherMA', label: 'Higher MA', group: 'Analysis' },

  // Entry & Capital
  {
    value: 'strategy_entry',
    label: 'Strategy Entry',
    group: 'Entry & Capital',
  },
  {
    value: 'strategy_volatility_filter',
    label: 'Volatility Filter',
    group: 'Entry & Capital',
  },
  {
    value: 'strategy_capital',
    label: 'Strategy Capital',
    group: 'Entry & Capital',
  },
  {
    value: 'strategy_sizing',
    label: 'Strategy Sizing',
    group: 'Entry & Capital',
  },

  // Exits
  { value: 'strategy_exits_take_profit', label: 'Take Profit', group: 'Exits' },
  { value: 'strategy_exits_stop_loss', label: 'Stop Loss', group: 'Exits' },
  { value: 'strategy_exits_trailing', label: 'Trailing', group: 'Exits' },
  { value: 'strategy_exits_time_exit', label: 'Time Exit', group: 'Exits' },
  {
    value: 'strategy_exits_opposite_count_exit',
    label: 'Opposite Count Exit',
    group: 'Exits',
  },
];
