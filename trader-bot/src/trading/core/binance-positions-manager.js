import {
  adjustPrice,
  adjustQuantity,
  closePosition as binanceClosePosition,
  cancelAllOrders,
  getLiveState,
  getSymbolFilters,
  openMarketOrder,
  placeStopLoss,
  placeTakeProfit,
} from '../binance/binance.js';

function oppositeSide(side) {
  return side === 'LONG' ? 'SHORT' : 'LONG';
}

export async function getActivePositions(symbol) {
  if (!symbol) {
    throw new Error('getActivePositions requires a symbol');
  }

  const { position, orders } = await getLiveState(symbol);
  return position?.side ? [{ ...position, orders }] : [];
}
export async function closePosition(symbol, side, quantity) {
  return await binanceClosePosition(symbol, side, quantity);
}

export async function partialClosePosition(symbol, side, sizePct, price) {
  const { position } = await getLiveState(symbol);
  if (!position?.side) return null;

  const qty = (position.size * sizePct) / 100;
  return await binanceClosePosition(symbol, oppositeSide(side), qty / price);
}

export async function applyAddToPosition(symbol, side, addUsd, price, exits) {
  const filters = await getSymbolFilters(symbol);

  const rawQty = addUsd / price;
  const qty = adjustQuantity(filters, rawQty);
  if (!qty || Number(qty) <= 0) {
    console.error(`❌ Add qty too small for ${symbol}`);
    return null;
  }

  await openMarketOrder(symbol, side === 'LONG' ? 'BUY' : 'SELL', qty);
  console.log(`➕ Added ${addUsd}$ to ${symbol} @ ${price}`);

  await cancelAllOrders(symbol);

  const { position } = await getLiveState(symbol);
  const totalQty = position?.size || Number(qty) || 0;

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

  return await getLiveState(symbol);
}
