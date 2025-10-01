import { dayTradingPreset } from './day-trading';
import { defaultPreset } from './default';
import { positionTradingPreset } from './position-trading';
import { scalpingPreset } from './scalping';
import { swingTradingPreset } from './swing-trading';

export {
  dayTradingPreset,
  defaultPreset,
  positionTradingPreset,
  scalpingPreset,
  swingTradingPreset,
};

export const presets = {
  default: defaultPreset,
  'swing-trading': swingTradingPreset,
  scalping: scalpingPreset,
  'day-trading': dayTradingPreset,
  'position-trading': positionTradingPreset,
} as const;

export const presetOptions = [
  { value: 'default', label: 'Default' },
  { value: 'swing-trading', label: 'Swing Trading' },
  { value: 'scalping', label: 'Scalping' },
  { value: 'day-trading', label: 'Day Trading' },
  { value: 'position-trading', label: 'Position Trading' },
];

export type PresetKey = keyof typeof presets;
