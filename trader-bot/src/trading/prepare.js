import { getLastPrice } from '../utils/getLastPrice.js';

export async function preparePosition(symbol, cfg, analysis, side) {
  const { capital, sizing, exits } = cfg.strategy;
  const entryPrice = await getLastPrice(symbol);

  // 1. Базові розрахунки
  const leverage = capital.leverage || 1;
  const baseSize = sizing.baseSizeUsd;
  const maxSize = sizing.maxPositionUsd;
  const size = Math.min(baseSize, maxSize);
  const riskPerTradeUsd = (capital.account * capital.riskPerTradePct) / 100;

  // 2. Стоп-лосс
  let stopPrice = null;
  if (exits.sl.type === 'hard') {
    const movePct = exits.sl.hardPct / 100;
    stopPrice =
      side === 'LONG' ? entryPrice * (1 - movePct) : entryPrice * (1 + movePct);
  }

  // 3. Тейк-профіти
  const takeProfits = [];
  if (exits.tp.use) {
    exits.tp.tpGridPct.forEach((pct, i) => {
      const tpPrice =
        side === 'LONG'
          ? entryPrice * (1 + pct / 100)
          : entryPrice * (1 - pct / 100);

      takeProfits.push({
        price: tpPrice,
        sizePct: exits.tp.tpGridSizePct[i],
      });
    });
  }

  // 4. Позиція
  return {
    id: `${symbol}_${Date.now()}`,
    symbol,
    side,
    size,
    leverage,
    openedAt: new Date().toISOString(),
    status: 'OPEN',
    entryPrice,
    initialEntry: entryPrice,
    stopPrice,
    initialStopPrice: stopPrice,
    takeProfits,
    initialTPs: takeProfits,
    riskUsd: riskPerTradeUsd,
    analysisRefs: [analysis.time],
    updates: [
      { time: new Date().toISOString(), action: 'OPEN', price: entryPrice },
    ],
  };
}
