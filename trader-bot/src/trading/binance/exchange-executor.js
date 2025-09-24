// trading/executeTrade.js
import {
  openMarketOrder,
  placeStopLoss,
  placeTakeProfit,
  cancelAllOrders,
  getSymbolFilters,
  adjustQuantity,
  adjustPrice,
  getPosition,
  setLeverage,
} from './binance.js';

import { preparePosition } from '../core/prepare.js';

const TRADE_MODE = process.env.TRADE_MODE || 'paper';

function isValidStop(side, lastPrice, stopPrice) {
  return side === 'LONG' ? stopPrice < lastPrice : stopPrice > lastPrice;
}

export async function executeTrade(symbol, cfg, analysis, side, price) {
  // 0) готуємо локальний опис (тільки щоб порахувати size/SL/TP)
  let pos = await preparePosition(symbol, cfg, analysis, side, price);
  const { size, entryPrice, takeProfits, stopPrice } = pos;
  const leverage = cfg?.strategy?.capital?.leverage || 10;

  // PAPER: нічого не зберігаємо — просто повертаємо опис для логів/тестів
  if (TRADE_MODE === 'paper') {
    console.log(
      `🟢 [PAPER] Simulated ${side} ${symbol} @ ${entryPrice} (size=${size}$, lev=${leverage}x)`,
    );
    return pos;
  }

  // ---- LIVE MODE ----
  // 1) Виставляємо плече ПЕРЕД відкриттям
  try {
    await setLeverage(symbol, leverage);
    console.log(`⚙️ Set leverage ${leverage}x for ${symbol}`);
    pos.leverage = leverage; // фіксуємо у локальному об'єкті (для повернення)
  } catch (err) {
    console.error(
      `❌ Failed to set leverage for ${symbol}:`,
      err?.message || err,
    );
  }

  // 2) Фільтри біржі
  let filters;
  try {
    filters = await getSymbolFilters(symbol);
  } catch (err) {
    console.error(
      `❌ Failed to fetch filters for ${symbol}:`,
      err?.message || err,
    );
    return null;
  }

  const rawQty = size / entryPrice;
  const qty = adjustQuantity(filters, rawQty);
  if (!qty || Number(qty) <= 0) {
    console.error(
      `❌ Quantity too small, skip trade ${symbol} (raw=${rawQty})`,
    );
    return null;
  }

  // 3) Скасуємо всі старі ордери для символу (щоб не ловити конфлікти)
  try {
    await cancelAllOrders(symbol);
  } catch (err) {
    console.warn(
      `⚠️ Failed to cancel existing orders for ${symbol}:`,
      err?.message || err,
    );
  }

  // 4) Відкриваємо маркет-угоду
  try {
    await openMarketOrder(symbol, side === 'LONG' ? 'BUY' : 'SELL', qty);
    console.log(`✅ [LIVE] Opened ${side} ${symbol}, qty=${qty}`);
  } catch (err) {
    console.error(
      `❌ Failed to open market order for ${symbol}:`,
      err?.message || err,
    );
    return null;
  }

  // 5) Ставимо SL
  if (stopPrice && isValidStop(side, entryPrice, stopPrice)) {
    try {
      const stopPx = adjustPrice(filters, stopPrice);
      await placeStopLoss(symbol, side, stopPx, qty);
      console.log(`🛑 Stop-loss placed @ ${stopPx}`);
    } catch (err) {
      console.warn(`⚠️ Failed to place SL for ${symbol}:`, err?.message || err);
    }
  }

  // 6) Ставимо TP(и)
  if (Array.isArray(takeProfits) && takeProfits.length) {
    for (const tp of takeProfits) {
      try {
        const tpQty = adjustQuantity(filters, (qty * tp.sizePct) / 100);
        if (Number(tpQty) <= 0) continue;

        const tpPx = adjustPrice(filters, tp.price);
        await placeTakeProfit(symbol, side, tpPx, tpQty);
        console.log(`🎯 Take-profit @ ${tpPx} (${tp.sizePct}%)`);
      } catch (err) {
        console.warn(
          `⚠️ Failed to place TP for ${symbol}:`,
          err?.message || err,
        );
      }
    }
  }

  // 7) Підтягнемо факт із Binance (для повернення актуальних цифр)
  try {
    const live = await getPosition(symbol);
    if (live && Number(live.positionAmt) !== 0) {
      const avgEntry = Number(live.entryPrice);
      pos = {
        ...pos,
        entryPrice: avgEntry,
        size: Math.abs(Number(live.positionAmt)) * avgEntry, // $-нотіонал фактичної позиції
        updates: [
          ...(pos.updates || []),
          {
            time: new Date().toISOString(),
            action: 'OPEN_CONFIRMED',
            price: avgEntry,
          },
        ],
      };
    }
  } catch (err) {
    console.warn(
      `⚠️ Failed to read live position for ${symbol}:`,
      err?.message || err,
    );
  }

  // 8) НІЧОГО НЕ ЗБЕРІГАЄМО ЛОКАЛЬНО — просто повертаємо стан
  return pos;
}
