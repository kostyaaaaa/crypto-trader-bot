// src/trading/core/binance-positions-manager.ts
import type {
  BinanceSide,
  ExitPlan,
  LiveState,
  LiveStateFlat,
  Side,
} from '../../types';
import logger from '../../utils/db-logger';
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
} from '../binance/binance-functions/index';
import { getOpenPosition } from './history-store';

/* ===== Helpers ===== */
function oppositeSide(side: Side): Side {
  return side === 'LONG' ? 'SHORT' : 'LONG';
}

/* ===== API ===== */

export async function getActivePositions(
  symbol: string,
): Promise<LiveStateFlat[]> {
  if (!symbol) throw new Error('getActivePositions requires a symbol');

  const openDoc = await getOpenPosition(symbol);
  if (!openDoc) return [];

  const { position, orders } = await getLiveState(symbol);
  return position?.side
    ? [
        {
          side: position.side as Side,
          entryPrice: position.entryPrice ?? null,
          size: Number(position.size) || 0,
          leverage: position.leverage ?? null,
          unRealizedProfit: position.unRealizedProfit ?? null,
          isolatedMargin: position.isolatedMargin ?? null,
          initialMargin: position.initialMargin ?? null,
          markPrice: position.markPrice ?? null,
          orders: (orders || []).map((o) => ({
            type: o.type,
            price: o.price,
            qty: o.qty,
            side: o.side as BinanceSide,
            reduceOnly: !!o.reduceOnly,
          })),
        },
      ]
    : [];
}

export async function closePosition(
  symbol: string,
  side: Side,
  quantity: number,
) {
  return binanceClosePosition(symbol, side, quantity);
}

/**
 * Часткове закриття у відсотках від живої кількості.
 * ВАЖЛИВО: кількість в коінах (НЕ ділимо на ціну).
 */
export async function partialClosePosition(
  symbol: string,
  side: Side,
  sizePct: number,
): Promise<unknown | null> {
  const { position } = await getLiveState(symbol);
  if (!position?.side || !Number.isFinite(Number(position.size))) return null;

  const qtyCoins = (Number(position.size) * Number(sizePct)) / 100;
  if (qtyCoins <= 0) return null;

  return binanceClosePosition(symbol, oppositeSide(side), qtyCoins);
}

/**
 * Долив у $-нотіоналі + перевиставлення SL/TP
 */
export async function applyAddToPosition(
  symbol: string,
  side: Side,
  addUsd: number,
  price: number,
  exits?: ExitPlan,
): Promise<LiveState> {
  const filters = await getSymbolFilters(symbol);

  // Розрахунок коін-кількості з $-нотіоналу
  const rawQty = Number(addUsd) / Number(price);
  const qtyStr = adjustQuantity(filters, rawQty);
  const qtyNum = Number(qtyStr);

  if (!qtyStr || !Number.isFinite(qtyNum) || qtyNum <= 0) {
    logger.error(`❌ Add qty too small for ${symbol}`);
    return { position: null, orders: [] };
  }

  await openMarketOrder(symbol, side === 'LONG' ? 'BUY' : 'SELL', qtyStr);
  logger.info(`➕ Added ${addUsd}$ to ${symbol} @ ${price}`);

  // Щоб не висіли старі стопи
  await cancelAllOrders(symbol);

  // Оновлюємо live-стан і загальну кількість у коінах
  const state1 = await getLiveState(symbol);
  const totalQty = Number(state1.position?.size) || qtyNum || 0;

  // --- SL ---
  if (exits?.sl?.price && Number.isFinite(Number(exits.sl.price))) {
    const stopPx = Number(adjustPrice(filters, Number(exits.sl.price)));
    if (stopPx > 0 && totalQty > 0) {
      await placeStopLoss(symbol, side, stopPx, totalQty);
      logger.info(`🛑 New SL placed @ ${stopPx}`);
    }
  }

  // --- TP grid ---
  if (Array.isArray(exits?.tp)) {
    for (const tp of exits.tp) {
      const tpPx = Number(adjustPrice(filters, Number(tp.price)));
      const tpQtyStr = adjustQuantity(
        filters,
        (totalQty * Number(tp.sizePct)) / 100,
      );
      if (tpPx > 0 && Number(tpQtyStr) > 0) {
        await placeTakeProfit(symbol, side, tpPx, tpQtyStr);
        logger.info(`🎯 New TP @ ${tpPx} (${Number(tp.sizePct)}%)`);
      }
    }
  }

  return await getLiveState(symbol);
}
