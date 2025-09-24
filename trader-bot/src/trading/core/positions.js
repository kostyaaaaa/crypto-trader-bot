import {
  getLiveState,
  getOpenPositions,
  closePosition as binanceClosePosition,
  openMarketOrder,
  placeStopLoss,
  placeTakeProfit,
  cancelAllOrders,
  getSymbolFilters,
  adjustQuantity,
  adjustPrice,
} from '../binance/binance.js';

function oppositeSide(side) {
  return side === 'LONG' ? 'SHORT' : 'LONG';
}

/**
 * Отримати активні позиції
 */
export async function getActivePositions(symbol = null) {
  if (symbol) {
    const { position, orders } = await getLiveState(symbol);
    return position?.side ? [{ ...position, orders }] : [];
  } else {
    const positions = await getOpenPositions();
    return positions.filter(p => Number(p.positionAmt) !== 0);
  }
}

/**
 * Закрити позицію повністю
 */
export async function closePosition(symbol, side, quantity) {
  return await binanceClosePosition(symbol, side, quantity);
}

/**
 * Часткове закриття
 */
export async function partialClose(symbol, side, sizePct, price) {
  const { position } = await getLiveState(symbol);
  if (!position?.side) return null;

  const qty = (position.size * sizePct) / 100;
  return await binanceClosePosition(symbol, oppositeSide(side), qty / price);
}

/**
 * Долив до позиції (DCA/Add)
 */
export async function applyAddToPosition(symbol, side, addUsd, price, exits) {
  const filters = await getSymbolFilters(symbol);

  // 1. Відкрити додатковий маркет-ордер
  const rawQty = addUsd / price;
  const qty = adjustQuantity(filters, rawQty);
  if (!qty || Number(qty) <= 0) {
    console.error(`❌ Add qty too small for ${symbol}`);
    return null;
  }

  await openMarketOrder(symbol, side === 'LONG' ? 'BUY' : 'SELL', qty);
  console.log(`➕ Added ${addUsd}$ to ${symbol} @ ${price}`);

  // 2. Скасувати старі SL/TP
  await cancelAllOrders(symbol);

  // 3. Порахувати новий розмір всієї позиції
  const { position } = await getLiveState(symbol);
  const totalQty = position?.size || (Number(qty) || 0);

  // 4. Виставити нові SL/TP
  if (exits?.sl?.price) {
    const stopPx = adjustPrice(filters, exits.sl.price);
    await placeStopLoss(symbol, side, stopPx, totalQty);
    console.log(`🛑 New SL placed @ ${stopPx}`);
  }

  if (Array.isArray(exits?.tp)) {
    for (const tp of exits.tp) {
      const tpPx = adjustPrice(filters, tp.price);
      const tpQty = adjustQuantity(filters, (totalQty * tp.sizePct) / 100);
      if (tpQty > 0) {
        await placeTakeProfit(symbol, side, tpPx, tpQty);
        console.log(`🎯 New TP @ ${tpPx} (${tp.sizePct}%)`);
      }
    }
  }

  // 5. Повертаємо оновлений стан
  return await getLiveState(symbol);
}