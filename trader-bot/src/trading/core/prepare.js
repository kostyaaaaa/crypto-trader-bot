// trading/core/prepare.js

import { autoTakeProfits } from './autoTakeProfits.js';

export async function preparePosition(symbol, cfg, analysis, side, entryPrice) {
  const { capital, exits } = cfg.strategy;

  if (!Number.isFinite(entryPrice) || entryPrice <= 0) {
    throw new Error(`Invalid entry price for ${symbol}: ${entryPrice}`);
  }

  const leverage = Number(capital.leverage) || 1;
  const marginUsd =
    (Number(capital.account) * Number(capital.riskPerTradePct)) / 100;
  const sizeUsd = marginUsd * leverage;
  const qty = sizeUsd / entryPrice;

  const volMeta = analysis?.modules?.volatility?.meta || {};
  const atr = Number(volMeta.atr ?? 0);
  const atrPct = Number(volMeta.atrPct ?? 0);
  const atrWindow = Number(volMeta.window ?? 0);

  let stopPrice = null;
  let stopModel = 'none';

  if (exits?.sl?.type === 'hard' && Number.isFinite(exits.sl.hardPct)) {
    const slPct = exits.sl.hardPct / 100;
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

      const approxLossUsd = stopDist * qty;
      const lossPctOfMargin =
        marginUsd > 0 ? (approxLossUsd / marginUsd) * 100 : 0;
    } else if (Number.isFinite(exits.sl?.hardPct)) {
      const slPct = exits.sl.hardPct / 100;
      const lossUsd = marginUsd * slPct;
      const stopDist = lossUsd / qty;

      stopPrice =
        side === 'LONG' ? entryPrice - stopDist : entryPrice + stopDist;
      stopModel = 'fallback-hardPct_of_margin';
    }
  }

  let takeProfits = [];
  if (exits?.tp?.use) {
    if (Array.isArray(exits.tp.tpGridPct) && exits.tp.tpGridPct.length > 0) {
      for (let i = 0; i < exits.tp.tpGridPct.length; i++) {
        const pct = Number(exits.tp.tpGridPct[i]);
        if (!Number.isFinite(pct)) continue;

        const profitUsd = marginUsd * (pct / 100);
        const tpDist = profitUsd / qty;
        const tpPrice =
          side === 'LONG' ? entryPrice + tpDist : entryPrice - tpDist;

        const sizePct = Number(exits.tp.tpGridSizePct?.[i] ?? 0);

        const pctChange =
          side === 'LONG'
            ? Number((((tpPrice - entryPrice) / entryPrice) * 100).toFixed(3))
            : Number((((entryPrice - tpPrice) / entryPrice) * 100).toFixed(3));

        takeProfits.push({ price: tpPrice, sizePct, pct: pctChange });
      }
    }
  } else {
    takeProfits = autoTakeProfits({
      entryPrice,
      side,
      atr,
      stopPrice,
      regime: analysis?.modules?.volatility?.meta?.regime || 'NORMAL',
    });
  }

  const trailingEnabled = !!exits?.trailing?.use;
  const trailing = trailingEnabled
    ? {
        active: false,
        startAfterPct: exits.trailing.startAfterPct,
        trailStepPct: exits.trailing.trailStepPct,
        anchor: null,
      }
    : null;

  let rrrToFirstTp = null;
  if (stopPrice && takeProfits.length > 0) {
    const firstTp = takeProfits[0].price;
    const reward = Math.abs(firstTp - entryPrice);
    const risk = Math.abs(entryPrice - stopPrice);
    if (risk > 0) rrrToFirstTp = Number((reward / risk).toFixed(2));
  }

  const nowIso = new Date().toISOString();
  return {
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
    analysisRefs: analysis?.time ? [analysis.time] : [],
    context: {
      volatilityStatus: analysis?.modules?.volatility?.meta?.regime ?? null,
      trendRegimeSignal: analysis?.modules?.trendRegime?.signal ?? null,
      atr: Number.isFinite(atr) ? atr : null,
      atrPct: Number.isFinite(atrPct) ? atrPct : null,
      atrWindow: Number.isFinite(atrWindow) ? atrWindow : null,
      volatilityThresholds: volMeta.thresholds || null,
    },
    trailing,
    trailActive: trailingEnabled ? false : null,
    trailAnchor: trailingEnabled ? null : null,
  };
}
