// Spot Balance Response Types based on Binance API

export interface SpotCommissionRates {
  maker: string;
  taker: string;
  buyer: string;
  seller: string;
}

export interface SpotBalance {
  asset: string;
  free: string;
  locked: string;
}

export interface SpotAccountResponse {
  makerCommission: number;
  takerCommission: number;
  buyerCommission: number;
  sellerCommission: number;
  commissionRates: SpotCommissionRates;
  canTrade: boolean;
  canWithdraw: boolean;
  canDeposit: boolean;
  brokered: boolean;
  requireSelfTradePrevention: boolean;
  preventSor: boolean;
  updateTime: number;
  accountType: string;
  balances: SpotBalance[];
  permissions: string[];
  uid: number;
}
