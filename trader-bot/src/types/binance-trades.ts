// Binance trade-related types

export type UserTrade = {
  id: number; // tradeId from Binance
  orderId: number; // orderId that this trade belongs to
  symbol: string; // e.g. "ETHUSDT"
  side: 'BUY' | 'SELL'; // execution direction
  price: number; // execution price (number)
  qty: number; // quantity (in base asset), number
  realizedPnl: number; // realized PnL in quote currency (USDT), number
  marginAsset?: string; // usually "USDT"
  time: number; // timestamp in milliseconds (epoch ms)
};
