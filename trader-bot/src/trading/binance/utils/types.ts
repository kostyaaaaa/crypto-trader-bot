export interface TakeProfitPlanEntry {
  price: number;
  sizePct: number;
  pct?: number; // опційно (для realign)
}
export type Side = 'LONG' | 'SHORT' | null;

export interface OrderIds {
  entry: string | number | null;
  stop: string | number | null;
  takes: Array<string | number>;
}

export interface PreparedPosition {
  id: string;
  symbol: string;
  side: Side;
  size: number; // $ notionals (може оновитись після live підтвердження)
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
  analysis: string | null; // ObjectId як string (опційно)
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
  // мінімум того, що потрібно для quantize:
  // твої реалізації adjustPrice/adjustQuantity можуть вимагати інші поля — тоді розшир.
  pricePrecision?: number;
  quantityPrecision?: number;
  tickSize?: number;
  stepSize?: number;
  minQty?: number;
}

export interface LivePosition {
  entryPrice: string | number;
  positionAmt: string | number;
}
