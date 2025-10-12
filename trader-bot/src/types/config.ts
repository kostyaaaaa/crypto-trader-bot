// Configuration types
import type { ICapitalConfig, IExitsConfig } from 'crypto-trader-db';

export interface StrategyConfig {
  capital: ICapitalConfig;
  exits: IExitsConfig;
}

export interface BotConfig {
  strategy: StrategyConfig;
}
