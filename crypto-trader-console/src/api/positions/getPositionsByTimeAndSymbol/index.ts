import axiosInterceptor from '../../axiosClient';
import type { IAnalysis } from './types';

export const getPositionsByTimeAndSymbol = async (
  dateFrom: string,
  dateTo: string,
  symbol?: string | null,
): Promise<ApiPositionsResponse> => {
  const queryParams = new URLSearchParams();

  if (symbol) queryParams.append('symbol', symbol);
  queryParams.append('dateFrom', dateFrom);
  queryParams.append('dateTo', dateTo);

  const search_query = `?${queryParams.toString()}`;

  const { data } = await axiosInterceptor.get(`/positions${search_query}`);

  return data;
};

// ──────────────────────────────────────────────────────────────────────────────
// Expanded Position types (used by Positions page, TP timeline, etc.)
// ──────────────────────────────────────────────────────────────────────────────
export type PositionStatus = 'OPEN' | 'CLOSED';
export type PositionSide = 'LONG' | 'SHORT';
export type ClosedBy =
  | 'TP'
  | 'SL'
  | 'Manually'
  | 'SYSTEM'
  | 'UNKNOWN'
  | null
  | undefined;

export interface TakeProfitFill {
  qty: number; // base asset quantity
  price: number; // execution price
  time: string; // ISO timestamp
  fee?: number;
  feeAsset?: string | null;
}

export interface TakeProfit {
  price: number;
  sizePct: number; // % of initial size
  filled: boolean;
  fills?: TakeProfitFill[]; // partial fills history
  cum?: number; // cumulative filled qty for this TP (base units)
  orderId?: number | string; // exchange order id
}

export interface TPUpdateAdjustment {
  type: 'TP_UPDATE';
  ts?: number | string; // event time (ms or ISO)
  reason?: 'TP_FILLED' | 'TP_ADJUSTED' | string;
  baseEntry?: number;
  tps: Array<{
    price: number;
    sizePct: number;
    filled?: boolean;
    fills?: TakeProfitFill[];
    cum?: number;
    orderId?: number | string;
  }>;
}

export interface SLUpdateAdjustment {
  type: 'SL_UPDATE';
  ts?: number | string;
  reason?: 'FILLED' | 'BREAKEVEN' | 'TRAIL' | string;
  price?: number;
}

export type Adjustment =
  | TPUpdateAdjustment
  | SLUpdateAdjustment
  | {
      type: string;
      ts?: number | string;
      // allow forward-compat fields
      [k: string]: unknown;
    };

export interface PositionMeta {
  leverage: number;
  openedBy: string; // e.g. 'BOT' | 'MANUAL'
  riskPct: number;
  strategyName: string | null;
}

export interface TrailingState {
  active: boolean;
  startAfterPct: number;
  trailStepPct: number;
  anchor: number | null;
}

export interface Position {
  _id: string;
  symbol: string;
  side: PositionSide;
  entryPrice: number;
  size: number; // notional in quote terms in your app
  openedAt: string; // ISO string
  status: PositionStatus;
  stopPrice: number;
  initialStopPrice: number | null;

  // Optional/extended fields used by details drawer
  takeProfits?: TakeProfit[];
  initialTPs?: Array<{ price: number; sizePct: number }>;
  trailing?: TrailingState;
  realizedPnl?: number;
  fees?: number;
  executions?: unknown[];
  adds?: unknown[];
  adjustments?: Adjustment[];

  analysis?: IAnalysis;
  meta: PositionMeta;

  // Closing info
  closedAt: string;
  closedBy: ClosedBy;
  finalPnl: number;
}

export interface ApiPositionsResponse {
  count: number;
  data: Position[];
  message: string;
  success: boolean;
  timestamp: string;
}
