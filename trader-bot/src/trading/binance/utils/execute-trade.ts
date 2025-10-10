import logger from '../../../utils/db-logger.ts';
import { updateStopPrice, updateTakeProfits } from '../../core/history-store.ts';
import { preparePosition } from '../../core/prepare.ts';
import {
  adjustPrice,
  adjustQuantity,
  cancelAllOrders,
  getPosition,
  getSymbolFilters,
  openMarketOrder,
  placeStopLoss,
  placeTakeProfit,
  setLeverage,
} from '../binance-functions/index.ts';
import { normalizeTpPlan } from './normalize-tp-plan.ts';
import type {
  ExchangeFilters,
  LivePosition,
  OrderIds,
  PreparedPosition,
  Side,
  TakeProfitPlanEntry,
} from './types.ts';
import { validateStop } from './validate-stop.ts';

export async function executeTrade(
  symbol: string,
  cfg: any,
  analysis: any,
  side: Side,
  price: number,
): Promise<PreparedPosition | null> {
  let pos = (await preparePosition(
    symbol,
    cfg,
    analysis,
    side,
    price,
  )) as PreparedPosition;
  const leverage: number = Number(cfg?.strategy?.capital?.leverage ?? 10);

  pos.takeProfits = normalizeTpPlan(pos.takeProfits);
  const { size, entryPrice, takeProfits, stopPrice } = pos;

  const orderIds: OrderIds = { entry: null, stop: null, takes: [] };

  // 1) Плече перед входом
  try {
    await setLeverage(symbol, leverage);
    pos.leverage = leverage;
  } catch (err: any) {
    logger.error(
      `❌ Failed to set leverage for ${symbol}:`,
      err?.message || err,
    );
  }

  // 2) Фільтри біржі
  let filters: ExchangeFilters;
  try {
    filters = (await getSymbolFilters(symbol)) as ExchangeFilters;
  } catch (err: any) {
    logger.error(
      `❌ Failed to fetch filters for ${symbol}:`,
      err?.message || err,
    );
    return null;
  }

  // кількість у базовій валюті
  const rawQty = size / entryPrice;
  const qty = Number(adjustQuantity(filters as any, rawQty));
  logger.info(
    `📏 Position sizing ${symbol}: size=${size}$, entry=${entryPrice}, rawQty=${rawQty}, adjustedQty=${qty}`,
  );
  if (!qty || qty <= 0) {
    logger.error(`❌ Quantity too small, skip trade ${symbol} (raw=${rawQty})`);
    return null;
  }

  // 3) Скасовуємо всі активні ордери по символу (захист від “зависів”)
  try {
    await cancelAllOrders(symbol);
  } catch (err: any) {
    logger.warn(
      `⚠️ Failed to cancel existing orders for ${symbol}:`,
      err?.message || err,
    );
  }

  // 4) Маркет-вхід
  try {
    const entryOrder = await openMarketOrder(
      symbol,
      side === 'LONG' ? 'BUY' : 'SELL',
      qty,
    );
    orderIds.entry = (entryOrder as any)?.orderId ?? null;
    logger.info(
      `✅ [LIVE] Opened ${side} ${symbol}, qty=${qty}, orderId=${orderIds.entry}`,
    );
  } catch (err: any) {
    logger.error(
      `❌ Failed to open market order for ${symbol}:`,
      err?.message || err,
    );
    return null;
  }

  // 5) Stop-loss (reduceOnly, валідність ціни)
  let effectiveStopPrice = stopPrice ?? null;
  if (!Number.isFinite(effectiveStopPrice)) {
    logger.warn(
      `⚠️ No stopPrice calculated for ${symbol}, fallback to hard stop (-5%).`,
    );
    effectiveStopPrice =
      side === 'LONG' ? entryPrice * 0.95 : entryPrice * 1.05;
  }

  if (
    Number.isFinite(effectiveStopPrice) &&
    validateStop(side, entryPrice, entryPrice, Number(effectiveStopPrice))
  ) {
    try {
      const stopPx = Number(
        adjustPrice(filters as any, Number(effectiveStopPrice)),
      );
      const slOrder = await placeStopLoss(symbol, side, stopPx, qty);
      orderIds.stop = (slOrder as any)?.orderId ?? null;
      logger.info(`🛑 Stop-loss placed @ ${stopPx}, orderId=${orderIds.stop}`);
      try {
        await updateStopPrice(symbol, stopPx, 'OPEN');
      } catch (err: any) {
        logger.warn(
          `⚠️ Failed to update stop price for ${symbol}:`,
          err?.message || err,
        );
      }
    } catch (err: any) {
      logger.warn(`⚠️ Failed to place SL for ${symbol}:`, err?.message || err);
    }
  } else {
    logger.info(
      `ℹ️ SL skipped (invalid or not provided): stopPrice=${effectiveStopPrice}`,
    );
  }

  // 6) Take-profits (reduceOnly, сума = 100%)
  if (Array.isArray(takeProfits) && takeProfits.length) {
    try {
      const totalQty = Number(qty);
      let allocated = 0;
      const tpPlan: TakeProfitPlanEntry[] = [];

      for (let i = 0; i < takeProfits.length; i++) {
        const { price: p, sizePct } = takeProfits[i];

        const targetRaw = (totalQty * sizePct) / 100;
        let tpQty: number;

        if (i === takeProfits.length - 1) {
          const remainderRaw = Math.max(totalQty - allocated, 0);
          tpQty = Number(adjustQuantity(filters as any, remainderRaw));
        } else {
          tpQty = Number(adjustQuantity(filters as any, targetRaw));
        }

        if (!Number.isFinite(tpQty) || tpQty <= 0) {
          logger.info(`ℹ️ Skip TP#${i + 1}: qty=${tpQty}`);
          continue;
        }

        if (allocated + tpQty > totalQty)
          tpQty = Math.max(totalQty - allocated, 0);
        if (tpQty <= 0) continue;

        const tpPx = Number(adjustPrice(filters as any, p));
        const tpOrder = await placeTakeProfit(symbol, side, tpPx, tpQty);

        allocated += tpQty;
        const oid = (tpOrder as any)?.orderId;
        if (oid) orderIds.takes.push(oid);

        tpPlan.push({ price: tpPx, sizePct });

        logger.info(
          `🎯 TP#${i + 1} @ ${tpPx} for qty=${tpQty} (${sizePct.toFixed(2)}%), orderId=${oid}`,
        );
      }

      try {
        await updateTakeProfits(symbol, tpPlan, entryPrice, 'OPEN');
      } catch (err: any) {
        logger.warn(
          `⚠️ Failed to update take profits for ${symbol}:`,
          err?.message || err,
        );
      }

      const diff = totalQty - allocated;
      if (diff > 0) {
        logger.info(`ℹ️ Unallocated qty due to quantization: ${diff}`);
      }
    } catch (err: any) {
      logger.warn(
        `⚠️ Failed to place TP grid for ${symbol}:`,
        err?.message || err,
      );
    }
  } else {
    logger.info('ℹ️ No TP plan provided (skip TP placement).');
  }

  // 7) Підтверджуємо фактичні цифри з Binance (entry avg, фактична кількість)
  try {
    const live = (await getPosition(symbol)) as Partial<LivePosition> | null;
    if (live && Number(live.positionAmt) !== 0) {
      const avgEntry = Number(live.entryPrice);
      pos = {
        ...pos,
        entryPrice: avgEntry,
        size: Math.abs(Number(live.positionAmt)) * avgEntry,
        orderIds,
        updates: [
          ...(pos.updates || []),
          {
            time: new Date().toISOString(),
            action: 'OPEN_CONFIRMED',
            price: avgEntry,
          },
        ],
      };
    } else {
      pos.orderIds = orderIds;
    }
  } catch (err: any) {
    logger.warn(
      `⚠️ Failed to read live position for ${symbol}:`,
      err?.message || err,
    );
    pos.orderIds = orderIds;
  }

  // 7.1) Якщо avgEntry суттєво відрізняється — перестворюємо SL/TP відносно avgEntry
  try {
    const live = (await getPosition(symbol)) as Partial<LivePosition> | null;
    const avgEntry = Number(live?.entryPrice);
    const liveQty = Math.abs(Number(live?.positionAmt || 0));

    const slippagePct =
      Number.isFinite(avgEntry) && Number.isFinite(entryPrice) && entryPrice > 0
        ? (Math.abs(avgEntry - entryPrice) / entryPrice) * 100
        : 0;

    if (liveQty > 0 && slippagePct > 0.05 && Array.isArray(pos.takeProfits)) {
      logger.info(
        `♻️ Realign SL/TP to avgEntry (slippage=${slippagePct.toFixed(3)}%)...`,
      );

      try {
        await cancelAllOrders(symbol);
      } catch (err: any) {
        logger.warn(
          `⚠️ Failed to cancel existing orders before realign for ${symbol}:`,
          err?.message || err,
        );
      }

      // 7.1.a) SL
      try {
        if (Number.isFinite(pos.stopPrice)) {
          const absDelta = Math.abs(Number(entryPrice) - Number(pos.stopPrice));
          const newStop =
            side === 'LONG' ? avgEntry - absDelta : avgEntry + absDelta;

          if (validateStop(side, avgEntry, avgEntry, newStop)) {
            const stopPx = Number(adjustPrice(filters as any, newStop));
            const slOrder = await placeStopLoss(symbol, side, stopPx, liveQty);
            orderIds.stop = (slOrder as any)?.orderId || orderIds.stop;
            await updateStopPrice(symbol, stopPx, 'OPEN_REALIGN');
            logger.info(`🛑 SL realigned @ ${stopPx} (absΔ=${absDelta})`);
          }
        }
      } catch (err: any) {
        logger.warn(
          `⚠️ Failed to realign SL for ${symbol}:`,
          err?.message || err,
        );
      }

      // 7.1.b) TP
      try {
        const totalQty = Number(liveQty);
        let allocated = 0;
        const tpPlan: TakeProfitPlanEntry[] = [];

        for (let i = 0; i < pos.takeProfits.length; i++) {
          const { price: oldPrice, sizePct, pct } = pos.takeProfits[i];

          let distPct = Number(pct);
          if (!Number.isFinite(distPct)) {
            distPct =
              side === 'LONG'
                ? ((oldPrice - entryPrice) / entryPrice) * 100
                : ((entryPrice - oldPrice) / entryPrice) * 100;
          }

          const targetPx =
            side === 'LONG'
              ? avgEntry * (1 + distPct / 100)
              : avgEntry * (1 - distPct / 100);

          const targetRaw = (totalQty * Number(sizePct || 0)) / 100;
          let tpQty: number;
          if (i === pos.takeProfits.length - 1) {
            const remainderRaw = Math.max(totalQty - allocated, 0);
            tpQty = Number(adjustQuantity(filters as any, remainderRaw));
          } else {
            tpQty = Number(adjustQuantity(filters as any, targetRaw));
          }

          if (!Number.isFinite(tpQty) || tpQty <= 0) continue;
          if (allocated + tpQty > totalQty)
            tpQty = Math.max(totalQty - allocated, 0);
          if (tpQty <= 0) continue;

          const tpPx = Number(adjustPrice(filters as any, targetPx));
          const tpOrder = await placeTakeProfit(symbol, side, tpPx, tpQty);
          const oid = (tpOrder as any)?.orderId;
          if (oid) orderIds.takes.push(oid);
          allocated += tpQty;
          tpPlan.push({ price: tpPx, sizePct });
          logger.info(
            `🎯 TP(realigned)#${i + 1} @ ${tpPx} for qty=${tpQty} (${Number(sizePct).toFixed(2)}%)`,
          );
        }

        await updateTakeProfits(symbol, tpPlan, avgEntry, 'OPEN_REALIGN');

        const diff = totalQty - allocated;
        if (diff > 0) logger.info(`ℹ️ Unallocated qty after realign: ${diff}`);
      } catch (err: any) {
        logger.warn(
          `⚠️ Failed to realign TP grid for ${symbol}:`,
          err?.message || err,
        );
      }
    }
  } catch (err: any) {
    logger.warn(`⚠️ Realign check failed for ${symbol}:`, err?.message || err);
  }

  return pos;
}
