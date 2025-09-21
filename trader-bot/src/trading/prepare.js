// trading/prepare.js
import { getLastPrice } from '../utils/getLastPrice.js';

/**
 * Готує об'єкт позиції з коректним ризик-сайзингом, SL/TP, трейлом і time-stop.
 * size = USD-нотионал (як і було у тебе в історії).
 */
export async function preparePosition(symbol, cfg, analysis, side) {
  const { capital, sizing, exits } = cfg.strategy;

  // 1) Ціна входу
  const entryPrice = await getLastPrice(symbol);
  if (!Number.isFinite(entryPrice) || entryPrice <= 0) {
    throw new Error(`Invalid entry price for ${symbol}: ${entryPrice}`);
  }

  // 2) Ризик / леверидж
  const leverage = capital.leverage || 1;
  const riskPerTradeUsd = (capital.account * capital.riskPerTradePct) / 100;

  // Витягуємо волатильність (для ATR-стопа і контексту)
  const volMeta = analysis?.modules?.volatility?.meta || {};
  const atr = Number(volMeta.atr ?? 0);
  const atrPct = Number(volMeta.atrPct ?? 0);
  const atrWindow = Number(volMeta.window ?? 0);
  const volatilityRegime = volMeta.regime ?? null;
  const volatilityThresholds = volMeta.thresholds || null;

  // 3) Стоп-лосс (hard або ATR)
  let stopPrice = null;
  let stopModel = 'none';

  if (exits?.sl?.type === 'hard' && Number.isFinite(exits.sl.hardPct)) {
    const movePct = exits.sl.hardPct / 100;
    stopPrice =
      side === 'LONG' ? entryPrice * (1 - movePct) : entryPrice * (1 + movePct);
    stopModel = 'hardPct';
  }

  if (exits?.sl?.type === 'atr') {
    const atrMult = exits.sl.atrMult ?? 1.0;
    if (Number.isFinite(atr) && atr > 0) {
      const moveAbs = atr * atrMult;
      stopPrice = side === 'LONG' ? entryPrice - moveAbs : entryPrice + moveAbs;
      stopModel = `atr×${atrMult}`;
    }
  }

  // 4) Розмір позиції (USD) через ризик, якщо SL відомий
  let size = sizing.baseSizeUsd; // дефолт — базовий
  let sizingModel = 'fixedBase';

  if (stopPrice && stopPrice > 0 && stopPrice !== entryPrice) {
    const pctMove = Math.abs(entryPrice - stopPrice) / entryPrice; // доля руху до SL
    if (pctMove > 0) {
      const candidate = riskPerTradeUsd / pctMove; // USD-нотионал
      size = Math.min(candidate, sizing.maxPositionUsd);
      sizingModel = 'risk';
    }
  }

  // Не перевищуємо верхню межу по розміру
  size = Math.max(0, Math.min(size, sizing.maxPositionUsd));

  // 5) Тейк-профіти (грид)
  const takeProfits = [];
  if (exits?.tp?.use && Array.isArray(exits.tp.tpGridPct)) {
    const grid = exits.tp.tpGridPct;
    const sizes = Array.isArray(exits.tp.tpGridSizePct)
      ? exits.tp.tpGridSizePct
      : [];

    for (let i = 0; i < grid.length; i++) {
      const pct = Number(grid[i]);
      if (!Number.isFinite(pct)) continue;

      const tpPrice =
        side === 'LONG'
          ? entryPrice * (1 + pct / 100)
          : entryPrice * (1 - pct / 100);

      const sizePct = Number(sizes[i] ?? 0);
      takeProfits.push({
        price: tpPrice,
        sizePct: Math.max(0, Math.min(100, sizePct)),
      });
    }
  }

  // 6) Time stop (expiresAt)
  let expiresAt = null;
  if (exits?.time?.maxHoldMin > 0) {
    expiresAt = new Date(
      Date.now() + exits.time.maxHoldMin * 60_000,
    ).toISOString();
  }

  // 7) Trailing stop (новий формат + зворотна сумісність)
  const trailingEnabled = !!exits?.trailing?.use;
  const trailing = trailingEnabled
    ? {
        active: false,
        startAfterPct: exits.trailing.startAfterPct,
        trailStepPct: exits.trailing.trailStepPct,
        anchor: null,
      }
    : null;

  // 8) RRR (до першого TP), якщо є SL і хоч один TP
  let rrrToFirstTp = null;
  if (stopPrice && takeProfits.length > 0) {
    const firstTp = takeProfits[0].price;
    const reward = Math.abs(firstTp - entryPrice);
    const risk = Math.abs(entryPrice - stopPrice);
    if (risk > 0) rrrToFirstTp = Number((reward / risk).toFixed(2));
  }

  // 9) Формуємо позицію
  const nowIso = new Date().toISOString();

  return {
    id: `${symbol}_${Date.now()}`,
    symbol,
    side, // LONG / SHORT
    size, // USD-нотионал
    leverage,
    openedAt: nowIso,
    status: 'OPEN',

    entryPrice,
    initialEntry: entryPrice,

    stopPrice,
    stopModel,
    initialStopPrice: stopPrice,

    takeProfits,
    initialTPs: takeProfits,

    riskUsd: riskPerTradeUsd,
    sizingModel, // 'risk' | 'fixedBase'
    rrrToFirstTp,

    // менеджмент
    expiresAt,
    trailing,
    // зворотна сумісність
    trailActive: trailingEnabled ? false : undefined,
    trailAnchor: trailingEnabled ? null : undefined,

    // контекст (для подальших ADD/перерахунків SL за ATR)
    analysisRefs: analysis?.time ? [analysis.time] : [],
    context: {
      volatilityStatus: volatilityRegime, // DEAD/NORMAL/EXTREME
      trendRegimeSignal: analysis?.modules?.trendRegime?.signal ?? null,
      atr: Number.isFinite(atr) ? atr : null,
      atrPct: Number.isFinite(atrPct) ? atrPct : null,
      atrWindow: Number.isFinite(atrWindow) ? atrWindow : null,
      volatilityThresholds: volatilityThresholds || null,
    },

    // аудит
    updates: [{ time: nowIso, action: 'OPEN', price: entryPrice }],
  };
}
