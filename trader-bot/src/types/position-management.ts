// Position management types
import type { Side } from './common';

export interface TakeProfitPlanEntry {
  price: number;
  sizePct: number;
  pct?: number; // optional (for realignment)
}

export interface TakeProfitLevel extends TakeProfitPlanEntry {
  // Alias for consistency with prepare.ts
}

export interface OrderIds {
  entry: string | number | null;
  stop: string | number | null;
  takes: Array<string | number>;
}

export interface PreparedPosition {
  id: string;
  symbol: string;
  side: Side;
  size: number; // $ notionals (may update after live confirmation)
  initialSizeUsd: number;
  leverage: number;
  qty: number;
  marginUsd: number;
  openedAt: string; // ISO
  status: 'OPEN';
  entryPrice: number;
  initialEntry: number;
  stopPrice: number | null;
  stopModel: string;
  initialStopPrice: number | null;
  takeProfits: TakeProfitPlanEntry[];
  initialTPs: TakeProfitPlanEntry[];
  rrrToFirstTp: number | null;
  updates: Array<{ time: string; action: string; price?: number }>;
  analysis: string | null; // ObjectId as string (optional)
  context?: Record<string, unknown>;
  trailing: null | {
    active: boolean;
    startAfterPct: number;
    trailStepPct: number;
    anchor: number | null;
  };
  trailActive: boolean | null;
  trailAnchor: number | null;
  orderIds?: OrderIds;
}

export interface ExchangeFilters {
  // minimum required for quantize:
  pricePrecision?: number;
  quantityPrecision?: number;
  tickSize?: number;
  stepSize?: number;
  minQty?: number;
}
