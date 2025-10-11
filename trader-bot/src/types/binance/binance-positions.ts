// Binance position-related types
import type { Side } from '../common';
import type { LiveOrder } from './binance-orders';

// Raw live position from exchange/state (before normalization)
export interface LivePosition {
  side?: Side; // LONG | SHORT | null
  size?: number | string | null; // exchange may return string; we normalize elsewhere
  entryPrice?: number | string | null;
  positionAmt?: number | string; // raw position amount from Binance
  leverage?: number | string | null;
  unRealizedProfit?: number | string | null;
  isolatedMargin?: number | string | null;
  initialMargin?: number | string | null;
  markPrice?: number | string | null;
}

// Canonical live state used by get-live-state.ts
export interface LiveState {
  position: LivePosition | null;
  orders: LiveOrder[];
}

export interface LiveStateFlat {
  side: Side; // LONG | SHORT | null
  size: number; // in coins (abs(positionAmt))
  entryPrice: number | null;
  leverage: number | null;
  unRealizedProfit: number | null;
  isolatedMargin: number | null;
  initialMargin: number | null;
  markPrice: number | null;
  orders: LiveOrder[]; // only SL/TP (without OTHER)
}

export interface FuturesPositionRisk {
  symbol: string;
  positionAmt: string;
  entryPrice: string;
  leverage: string;
  unRealizedProfit?: string;
  unrealizedProfit?: string;
  isolatedMargin?: string;
  initialMargin?: string;
  markPrice?: string;
}

// Exit plan structure used by binance-positions-manager
export type ExitPlan = {
  sl?: { price: number | null };
  tp?: Array<{ price: number | null; sizePct: number }>;
};
