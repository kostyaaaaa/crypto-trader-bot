// PnL Response Types based on Binance API

export interface PnLIncomeItem {
  symbol: string;
  incomeType: string;
  income: string;
  asset: string;
  time: number;
  info: string;
  tranId: number;
  tradeId: string;
}

export type PnLIncomeResponse = PnLIncomeItem[];

// Custom response type for our getPnL function
export interface PnLSummaryResponse {
  daysBack: number;
  realizedPnL: number;
  currency: string;
  data: PnLIncomeItem[];
}

// Income types that can be returned from Binance
export type IncomeType =
  | 'TRANSFER'
  | 'WELCOME_BONUS'
  | 'REALIZED_PNL'
  | 'FUNDING_FEE'
  | 'COMMISSION'
  | 'INSURANCE_CLEAR'
  | 'REFERRAL_KICKBACK'
  | 'COMMISSION_DISCOUNT'
  | 'API_REBATE'
  | 'CONTEST_REWARD'
  | 'CROSS_COLLATERAL_TRANSFER'
  | 'OPTIONS_PREMIUM_FEE'
  | 'OPTIONS_SETTLE_PROFIT'
  | 'INTERNAL_TRANSFER'
  | 'AUTO_EXCHANGE'
  | 'DELIVERED_SETTELMENT'
  | 'COIN_SWAP_DEPOSIT'
  | 'COIN_SWAP_WITHDRAW'
  | 'POSITION_LIMIT_INCREASE_FEE';

export interface TypedPnLIncomeItem extends Omit<PnLIncomeItem, 'incomeType'> {
  incomeType: IncomeType;
}
