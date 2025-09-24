// trading/core/prepare.js

import { autoTakeProfits } from './autoTakeProfits.js';

export async function preparePosition(symbol, cfg, analysis, side, entryPrice) {
  const { capital, exits } = cfg.strategy;

  // 1) Ціна входу
  if (!Number.isFinite(entryPrice) || entryPrice <= 0) {
    throw new Error(`Invalid entry price for ${symbol}: ${entryPrice}`);
  }

  // 2) Розмір угоди / маржа
  const leverage = Number(capital.leverage) || 1;
  const marginUsd =
    (Number(capital.account) * Number(capital.riskPerTradePct)) / 100; // твоя маржа ($)
  const sizeUsd = marginUsd * leverage; // нотіонал з плечем
  const qty = sizeUsd / entryPrice; // кількість монет

  // 3) Волатильність (для ATR)
  const volMeta = analysis?.modules?.volatility?.meta || {};
  const atr = Number(volMeta.atr ?? 0);
  const atrPct = Number(volMeta.atrPct ?? 0);
  const atrWindow = Number(volMeta.window ?? 0);

  // 4) Стоп-лосс (рахуємо ВІД МАРЖІ)
  let stopPrice = null;
  let stopModel = 'none';

  if (exits?.sl?.type === 'hard' && Number.isFinite(exits.sl.hardPct)) {
    // hardPct — це % ВІД МАРЖІ
    const slPct = exits.sl.hardPct / 100;
    const lossUsd = marginUsd * slPct; // скільки $ готові втратити з маржі
    const stopDist = lossUsd / qty; // відстань у ціні

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

      // для розуміння у $, скільки це відносно твоєї маржі
      const approxLossUsd = stopDist * qty;
      const lossPctOfMargin =
        marginUsd > 0 ? (approxLossUsd / marginUsd) * 100 : 0;
    } else if (Number.isFinite(exits.sl?.hardPct)) {
      // fallback → hard % ВІД МАРЖІ
      const slPct = exits.sl.hardPct / 100;
      const lossUsd = marginUsd * slPct;
      const stopDist = lossUsd / qty;

      stopPrice =
        side === 'LONG' ? entryPrice - stopDist : entryPrice + stopDist;
      stopModel = 'fallback-hardPct_of_margin';
    }
  }

  // 5) Тейк-профіти (РАХУЄМО ВІД МАРЖІ)
  let takeProfits = [];
  if (exits?.tp?.use && Array.isArray(exits.tp.tpGridPct)) {
    // ручні TP
    for (let i = 0; i < exits.tp.tpGridPct.length; i++) {
      const pct = Number(exits.tp.tpGridPct[i]);
      if (!Number.isFinite(pct)) continue;

      const profitUsd = marginUsd * (pct / 100);
      const tpDist = profitUsd / qty;
      const tpPrice =
        side === 'LONG' ? entryPrice + tpDist : entryPrice - tpDist;

      const sizePct = Number(exits.tp.tpGridSizePct?.[i] ?? 0);
      takeProfits.push({ price: tpPrice, sizePct });
    }
  } else {
    // авто-TP (мінімальні аргументи)
    takeProfits = autoTakeProfits({
      entryPrice,
      side,
      atr,
      stopPrice,
      regime: analysis?.modules?.volatility?.meta?.regime || 'NORMAL',
    });
  }

  // 6) Trailing stop
  const trailingEnabled = !!exits?.trailing?.use;
  const trailing = trailingEnabled
    ? {
        active: false,
        startAfterPct: exits.trailing.startAfterPct,
        trailStepPct: exits.trailing.trailStepPct,
        anchor: null,
      }
    : null;

  // 7) RRR (у пунктах ціни) до першого TP
  let rrrToFirstTp = null;
  if (stopPrice && takeProfits.length > 0) {
    const firstTp = takeProfits[0].price;
    const reward = Math.abs(firstTp - entryPrice);
    const risk = Math.abs(entryPrice - stopPrice);
    if (risk > 0) rrrToFirstTp = Number((reward / risk).toFixed(2));
  }
  console.log(`📐 RRR (to TP1): ${rrrToFirstTp}`);

  // 8) Повертаємо позицію
  const nowIso = new Date().toISOString();
  return {
    id: `${symbol}_${Date.now()}`,
    symbol,
    side,

    // Розмір
    size: sizeUsd, // нотіонал (угода з плечем)
    initialSizeUsd: sizeUsd,
    leverage,
    qty,
    marginUsd, // 🔑 твоя маржа

    // Статус
    openedAt: nowIso,
    status: 'OPEN',

    // Ціни
    entryPrice,
    initialEntry: entryPrice,

    // SL / TP
    stopPrice,
    stopModel,
    initialStopPrice: stopPrice,
    takeProfits,
    initialTPs: takeProfits,

    // Метрики
    rrrToFirstTp,
    updates: [{ time: nowIso, action: 'OPEN', price: entryPrice }],

    // Контекст
    analysisRefs: analysis?.time ? [analysis.time] : [],
    context: {
      volatilityStatus: analysis?.modules?.volatility?.meta?.regime ?? null,
      trendRegimeSignal: analysis?.modules?.trendRegime?.signal ?? null,
      atr: Number.isFinite(atr) ? atr : null,
      atrPct: Number.isFinite(atrPct) ? atrPct : null,
      atrWindow: Number.isFinite(atrWindow) ? atrWindow : null,
      volatilityThresholds: volMeta.thresholds || null,
    },

    // Trailing
    trailing,
    trailActive: trailingEnabled ? false : null,
    trailAnchor: trailingEnabled ? null : null,
  };
}
