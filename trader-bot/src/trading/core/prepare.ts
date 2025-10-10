// src/trading/core/prepare.ts
import type { ICapitalConfig, IExitsConfig } from 'crypto-trader-db';
import { autoTakeProfits } from './calculate-auto-take-profits';
// ---- Local types (мінімально необхідні для цього модуля) ----
export type RawSide = 'LONG' | 'SHORT' | 'BUY' | 'SELL' | null;
export type Side = 'LONG' | 'SHORT';

export interface StrategyConfig {
  capital: ICapitalConfig;
  exits: IExitsConfig;
}

export interface BotConfig {
  strategy: StrategyConfig;
}

export interface VolatilityMeta {
  atrAbs?: number; // абсолютний ATR у цінах
  atrPct?: number; // ATR у %
  window?: number;
  thresholds?: unknown;
  regime?: 'DEAD' | 'NORMAL' | 'EXTREME';
}

export interface AnalysisLite {
  _id?: string;
  modules?: {
    volatility?: { meta?: VolatilityMeta };
    trendRegime?: { signal?: Side | 'NEUTRAL' };
  };
}

export interface TakeProfitLevel {
  price: number;
  sizePct: number; // % від поточної кількості
  pct?: number; // відстань до entry у %, інформативно
}

export interface PreparedPosition {
  id: string;
  symbol: string;
  side: Side;
  size: number; // notional USD
  initialSizeUsd: number; // дубль для історії
  leverage: number;
  qty: number; // кількість базового активу
  marginUsd: number; // маржа (USD)
  openedAt: string; // ISO
  status: 'OPEN';
  entryPrice: number;
  initialEntry: number;
  stopPrice: number | null;
  stopModel: string; // опис моделі стопа
  initialStopPrice: number | null;
  takeProfits: TakeProfitLevel[];
  initialTPs: TakeProfitLevel[];
  rrrToFirstTp: number | null; // risk:reward до першого TP
  updates: Array<{ time: string; action: 'OPEN'; price: number }>;
  analysis: string | null;
  context: {
    volatilityStatus: VolatilityMeta['regime'] | null;
    trendRegimeSignal: Side | 'NEUTRAL' | null;
    atr: number | null;
    atrAbs: number | null;
    atrPct: number | null;
    atrWindow: number | null;
    volatilityThresholds: unknown;
  };
  trailing: {
    active: boolean;
    startAfterPct: number;
    trailStepPct: number;
    anchor: number | null;
  } | null;
  trailActive: boolean | null;
  trailAnchor: number | null;
}

// ---- helpers ----
function normalizeSide(side: RawSide): Side {
  const s = String(side).toUpperCase() as RawSide;
  if (s === 'BUY') return 'LONG';
  if (s === 'SELL') return 'SHORT';
  return s as Side;
}

/**
 * Готує позицію до відкриття (paper/live): розрахунок розміру, SL/TP, trailing.
 */
export async function preparePosition(
  symbol: string,
  cfg: BotConfig,
  analysis: AnalysisLite | null,
  rawSide: RawSide,
  entryPrice: number,
): Promise<PreparedPosition> {
  const { capital, exits } = cfg.strategy;

  if (!Number.isFinite(entryPrice) || entryPrice <= 0) {
    throw new Error(`Invalid entry price for ${symbol}: ${entryPrice}`);
  }

  const side: Side = normalizeSide(rawSide);

  // ---- sizing ----
  const leverage = Number(capital.leverage) || 1;
  const marginUsd =
    (Number(capital.account) * Number(capital.riskPerTradePct)) / 100;
  const sizeUsd = marginUsd * leverage;
  const qty = sizeUsd / entryPrice;

  // ---- ATR/volatility meta ----
  const volMeta = analysis?.modules?.volatility?.meta ?? {};
  const atrAbsRaw = Number(volMeta.atrAbs ?? (volMeta as any).atr ?? NaN);
  const atrPctRaw = Number(volMeta.atrPct ?? NaN);

  const atr =
    Number.isFinite(atrAbsRaw) && atrAbsRaw > 0
      ? atrAbsRaw
      : Number.isFinite(atrPctRaw) && atrPctRaw > 0
        ? (entryPrice * atrPctRaw) / 100
        : 0;

  const atrPct =
    Number.isFinite(atr) && atr > 0
      ? (atr / entryPrice) * 100
      : Number.isFinite(atrPctRaw)
        ? atrPctRaw
        : 0;

  const atrWindow = Number(volMeta.window ?? 0);

  // ---- Stop Loss ----
  let stopPrice: number | null = null;
  let stopModel = 'none';

  if (exits?.sl?.type === 'hard' && Number.isFinite(exits.sl.hardPct)) {
    const slPct = (exits.sl.hardPct as number) / 100;
    const lossUsd = marginUsd * slPct;
    const stopDist = lossUsd / qty;
    stopPrice = side === 'LONG' ? entryPrice - stopDist : entryPrice + stopDist;
    stopModel = `hardPct_of_margin-${exits.sl.hardPct}`;
  }

  if (exits?.sl?.type === 'atr') {
    const atrMult = Number(exits.sl.atrMult ?? 1);
    if (Number.isFinite(atr) && atr > 0) {
      const stopDist = atr * atrMult;
      stopPrice =
        side === 'LONG' ? entryPrice - stopDist : entryPrice + stopDist;
      stopModel = `atr×${atrMult}`;
    } else if (Number.isFinite(exits.sl?.hardPct)) {
      const slPct = (exits.sl!.hardPct as number) / 100;
      const lossUsd = marginUsd * slPct;
      const stopDist = lossUsd / qty;
      stopPrice =
        side === 'LONG' ? entryPrice - stopDist : entryPrice + stopDist;
      stopModel = 'fallback-hardPct_of_margin';
    }
  }

  // ---- Take Profits ----
  const takeProfits: TakeProfitLevel[] = [];
  const tpCfg = exits?.tp;

  if (tpCfg?.use) {
    if (Array.isArray(tpCfg.tpGridPct) && tpCfg.tpGridPct.length > 0) {
      for (let i = 0; i < tpCfg.tpGridPct.length; i++) {
        const roiPct = Number(tpCfg.tpGridPct[i]);
        if (!Number.isFinite(roiPct)) continue;

        // ROI% на маржу → цінова відстань, що дає такий прибуток
        const profitUsd = marginUsd * (roiPct / 100);
        const tpDist = profitUsd / qty;
        const price =
          side === 'LONG' ? entryPrice + tpDist : entryPrice - tpDist;

        const sizePct = Number(tpCfg.tpGridSizePct?.[i] ?? 0);
        const pct = Number(
          (Math.abs((price - entryPrice) / entryPrice) * 100).toFixed(3),
        );

        takeProfits.push({ price, sizePct, pct });
      }
    }
  } else {
    // Авто-TP (ATR/regime-based)
    const auto = autoTakeProfits({
      entryPrice,
      side,
      atr,
      stopPrice,
      regime: volMeta?.regime || 'NORMAL',
    }) as TakeProfitLevel[];
    for (const tp of auto) {
      // нормалізуємо структуру (pct може бути не у відповіді)
      takeProfits.push({
        price: Number(tp.price),
        sizePct: Number(tp.sizePct ?? 0),
        pct:
          tp.pct != null
            ? Number(tp.pct)
            : Number(
                (Math.abs((tp.price - entryPrice) / entryPrice) * 100).toFixed(
                  3,
                ),
              ),
      });
    }
  }

  // ---- Trailing ----
  const trailingEnabled = !!exits?.trailing?.use;
  const trailing = trailingEnabled
    ? {
        active: false,
        startAfterPct: Number(exits!.trailing!.startAfterPct),
        trailStepPct: Number(exits!.trailing!.trailStepPct),
        anchor: null as number | null,
      }
    : null;

  // ---- RRR до першого TP ----
  let rrrToFirstTp: number | null = null;
  if (stopPrice && takeProfits.length > 0) {
    const firstTp = takeProfits[0].price;
    const reward = Math.abs(firstTp - entryPrice);
    const risk = Math.abs(entryPrice - stopPrice);
    if (risk > 0) rrrToFirstTp = Number((reward / risk).toFixed(2));
  }

  // ---- Output ----
  const nowIso = new Date().toISOString();
  const position: PreparedPosition = {
    id: `${symbol}_${Date.now()}`,
    symbol,
    side,
    size: sizeUsd,
    initialSizeUsd: sizeUsd,
    leverage,
    qty,
    marginUsd,
    openedAt: nowIso,
    status: 'OPEN',
    entryPrice,
    initialEntry: entryPrice,
    stopPrice,
    stopModel,
    initialStopPrice: stopPrice,
    takeProfits,
    initialTPs: takeProfits.map((tp) => ({ ...tp })),
    rrrToFirstTp,
    updates: [{ time: nowIso, action: 'OPEN', price: entryPrice }],
    analysis: (analysis as any)?._id ?? null,
    context: {
      volatilityStatus: volMeta.regime ?? null,
      trendRegimeSignal: analysis?.modules?.trendRegime?.signal ?? null,
      atr: Number.isFinite(atr) ? atr : null,
      atrAbs: Number.isFinite(atr) ? atr : null,
      atrPct: Number.isFinite(atrPct) ? atrPct : null,
      atrWindow: Number.isFinite(atrWindow) ? atrWindow : null,
      volatilityThresholds: volMeta.thresholds ?? null,
    },
    trailing,
    trailActive: trailingEnabled ? false : null,
    trailAnchor: trailingEnabled ? null : null,
  };

  return position;
}
