// trading/executeTrade.js
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
} from './binance.js';

import { updateStopPrice, updateTakeProfits } from '../core/historyStore.js';
import { preparePosition } from '../core/prepare.js';

const TRADE_MODE = process.env.TRADE_MODE || 'paper';

// Валідація стоп-лоса:
//  - має бути по "збитковій" стороні відносно ціни входу (entryRef)
//  - і (за наявності) не має бути по "прибутковій" стороні відносно поточної ціни (currentRef),
//    щоб не спрацював одразу після виставлення
function validateStop(side, entryRef, currentRef, stopPrice) {
  if (!Number.isFinite(stopPrice) || !Number.isFinite(entryRef)) return false;

  // умова збиткової сторони відносно ціни входу
  const okVsEntry =
    side === 'LONG' ? stopPrice < entryRef : stopPrice > entryRef;
  if (!okVsEntry) return false;

  // додаткова перевірка відносно поточної ціни, якщо передана
  if (Number.isFinite(currentRef)) {
    const okVsCurrent =
      side === 'LONG' ? stopPrice < currentRef : stopPrice > currentRef;
    if (!okVsCurrent) return false;
  }

  return true;
}

/**
 * НОРМАЛІЗАЦІЯ TP:
 *  - фільтрує невалідні
 *  - гарантує суму = 100% (останній добирає залишок)
 *  - якщо сума > 100 — масштабуються пропорційно
 */
function normalizeTpPlan(tps = []) {
  const plan = (tps || [])
    .map((tp) => ({
      price: Number(tp.price),
      sizePct: Number(tp.sizePct),
    }))
    .filter(
      (tp) =>
        Number.isFinite(tp.price) &&
        Number.isFinite(tp.sizePct) &&
        tp.sizePct > 0,
    );

  if (plan.length === 0) return [];

  const sum = plan.reduce((s, tp) => s + tp.sizePct, 0);

  if (sum === 100) return plan;

  if (sum < 100) {
    // добираємо залишок останньому
    const last = plan[plan.length - 1];
    last.sizePct += 100 - sum;
    return plan;
  }

  // sum > 100 → масштабувати пропорційно
  return plan.map((tp) => ({ ...tp, sizePct: (tp.sizePct / sum) * 100 }));
}

export async function executeTrade(symbol, cfg, analysis, side, price) {
  // 0) Локальна підготовка параметрів стратегії (size/SL/TP)
  let pos = await preparePosition(symbol, cfg, analysis, side, price);
  const leverage = cfg?.strategy?.capital?.leverage || 10;

  // нормалізуємо TP-план (через %)
  pos.takeProfits = normalizeTpPlan(pos.takeProfits);
  const { size, entryPrice, takeProfits, stopPrice } = pos;

  // PAPER MODE — просто повертаємо підготовлену позицію
  if (TRADE_MODE === 'paper') {
    console.log(
      `🟢 [PAPER] Simulated ${side} ${symbol} @ ${entryPrice} (size=${size}$, lev=${leverage}x)`,
    );
    return pos;
  }

  // LIVE MODE
  const orderIds = { entry: null, stop: null, takes: [] };

  // 1) Плече перед входом
  try {
    await setLeverage(symbol, leverage);
    pos.leverage = leverage;
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

  // кількість у базовій валюті
  const rawQty = size / entryPrice;
  const qty = adjustQuantity(filters, rawQty);
  console.log(
    `📏 Position sizing ${symbol}: size=${size}$, entry=${entryPrice}, rawQty=${rawQty}, adjustedQty=${qty}`,
  );
  if (!qty || Number(qty) <= 0) {
    console.error(
      `❌ Quantity too small, skip trade ${symbol} (raw=${rawQty})`,
    );
    return null;
  }

  // 3) Скасовуємо всі активні ордери по символу (захист від “зависів”)
  try {
    await cancelAllOrders(symbol);
  } catch (err) {
    console.warn(
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
    orderIds.entry = entryOrder?.orderId || null;
    console.log(
      `✅ [LIVE] Opened ${side} ${symbol}, qty=${qty}, orderId=${orderIds.entry}`,
    );
  } catch (err) {
    console.error(
      `❌ Failed to open market order for ${symbol}:`,
      err?.message || err,
    );
    return null;
  }

  // 5) Stop-loss (reduceOnly, валідність ціни)
  let effectiveStopPrice = stopPrice;
  if (!effectiveStopPrice) {
    console.warn(
      `⚠️ No stopPrice calculated for ${symbol}, fallback to hard stop (-5%).`,
    );
    effectiveStopPrice =
      side === 'LONG' ? entryPrice * 0.95 : entryPrice * 1.05;
  }

  if (validateStop(side, entryPrice, entryPrice, effectiveStopPrice)) {
    try {
      const stopPx = adjustPrice(filters, effectiveStopPrice);
      const slOrder = await placeStopLoss(symbol, side, stopPx, qty);
      orderIds.stop = slOrder?.orderId || null;
      console.log(`🛑 Stop-loss placed @ ${stopPx}, orderId=${orderIds.stop}`);
      try {
        await updateStopPrice(symbol, stopPx, 'OPEN');
      } catch (err) {
        console.warn(
          `⚠️ Failed to update stop price for ${symbol}:`,
          err?.message || err,
        );
      }
    } catch (err) {
      console.warn(`⚠️ Failed to place SL for ${symbol}:`, err?.message || err);
    }
  } else {
    console.log(
      `ℹ️ SL skipped (invalid or not provided): stopPrice=${effectiveStopPrice}`,
    );
  }

  // 6) Take-profits (reduceOnly, сума = 100%)
  if (Array.isArray(takeProfits) && takeProfits.length) {
    try {
      // Квантуємо TP-кількості; останній TP отримує залишок після квантування
      const totalQty = Number(qty);
      let allocated = 0;
      const tpPlan = [];

      for (let i = 0; i < takeProfits.length; i++) {
        const { price: p, sizePct } = takeProfits[i];

        // TP рахується від avgEntry, краще передавати відкориговані значення
        // сирий розрахунок
        const targetRaw = (totalQty * sizePct) / 100;

        // для останнього TP – віддамо весь залишок, але ОБОВʼЯЗКОВО квантуємо по stepSize
        let tpQty;
        if (i === takeProfits.length - 1) {
          const remainderRaw = Math.max(totalQty - allocated, 0);
          const q = adjustQuantity(filters, remainderRaw);
          tpQty = Number(q);
        } else {
          // квантуємо не останні
          const q = adjustQuantity(filters, targetRaw);
          tpQty = Number(q);
        }

        if (!Number.isFinite(tpQty) || tpQty <= 0) {
          console.log(`ℹ️ Skip TP#${i + 1}: qty=${tpQty}`);
          continue;
        }

        // не перевищуємо загальну кількість
        if (allocated + tpQty > totalQty)
          tpQty = Math.max(totalQty - allocated, 0);
        if (tpQty <= 0) continue;

        const tpPx = adjustPrice(filters, p);
        const tpOrder = await placeTakeProfit(symbol, side, tpPx, tpQty);

        allocated += tpQty;
        if (tpOrder?.orderId) orderIds.takes.push(tpOrder.orderId);

        tpPlan.push({ price: tpPx, sizePct });

        console.log(
          `🎯 TP#${i + 1} @ ${tpPx} for qty=${tpQty} (${sizePct.toFixed(2)}%), orderId=${tpOrder?.orderId}`,
        );
      }

      try {
        await updateTakeProfits(symbol, tpPlan, entryPrice, 'OPEN');
      } catch (err) {
        console.warn(
          `⚠️ Failed to update take profits for ${symbol}:`,
          err?.message || err,
        );
      }

      // якщо через квантування сума < totalQty — інформуємо (дрібна різниця ок)
      const diff = totalQty - allocated;
      if (diff > 0) {
        console.log(`ℹ️ Unallocated qty due to quantization: ${diff}`);
      }
    } catch (err) {
      console.warn(
        `⚠️ Failed to place TP grid for ${symbol}:`,
        err?.message || err,
      );
    }
  } else {
    console.log('ℹ️ No TP plan provided (skip TP placement).');
  }

  // 7) Підтверджуємо фактичні цифри з Binance (entry avg, фактична кількість)
  try {
    const live = await getPosition(symbol);
    if (live && Number(live.positionAmt) !== 0) {
      const avgEntry = Number(live.entryPrice);
      pos = {
        ...pos,
        // Використовуємо фактичний avgEntry з Binance для коректних TP/SL
        entryPrice: avgEntry,
        size: Math.abs(Number(live.positionAmt)) * avgEntry, // фактичний $-нотіонал
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
  } catch (err) {
    console.warn(
      `⚠️ Failed to read live position for ${symbol}:`,
      err?.message || err,
    );
    pos.orderIds = orderIds;
  }

  // 7.1) Якщо фактичний avgEntry суттєво відрізняється — перестворюємо SL/TP відносно avgEntry
  try {
    const live = await getPosition(symbol);
    const avgEntry = Number(live?.entryPrice);
    const liveQty = Math.abs(Number(live?.positionAmt || 0));

    // Перевиставляємо ордери лише якщо є позиція та відхилення > 0.05%
    const slippagePct =
      Number.isFinite(avgEntry) && Number.isFinite(entryPrice) && entryPrice > 0
        ? (Math.abs(avgEntry - entryPrice) / entryPrice) * 100
        : 0;

    if (liveQty > 0 && slippagePct > 0.05 && Array.isArray(pos.takeProfits)) {
      console.log(
        `♻️ Realign SL/TP to avgEntry (slippage=${slippagePct.toFixed(3)}%)...`,
      );

      // Скасовуємо попередні SL/TP і ставимо заново
      try {
        await cancelAllOrders(symbol);
      } catch (err) {
        console.warn(
          `⚠️ Failed to cancel existing orders before realign for ${symbol}:`,
          err?.message || err,
        );
      }

      // 7.1.a) Переобчислюємо STOP з таким самим абсолютним відхиленням від entry
      try {
        if (Number.isFinite(pos.stopPrice)) {
          const absDelta = Math.abs(Number(entryPrice) - Number(pos.stopPrice));
          const newStop =
            side === 'LONG' ? avgEntry - absDelta : avgEntry + absDelta;

          if (validateStop(side, avgEntry, avgEntry, newStop)) {
            const stopPx = adjustPrice(filters, newStop);
            const slOrder = await placeStopLoss(symbol, side, stopPx, liveQty);
            orderIds.stop = slOrder?.orderId || orderIds.stop;
            await updateStopPrice(symbol, stopPx, 'OPEN_REALIGN');
            console.log(`🛑 SL realigned @ ${stopPx} (absΔ=${absDelta})`);
          }
        }
      } catch (err) {
        console.warn(
          `⚠️ Failed to realign SL for ${symbol}:`,
          err?.message || err,
        );
      }

      // 7.1.b) Переобчислюємо TP-ціни, зберігаючи відсотки від входу
      try {
        const totalQty = Number(liveQty);
        let allocated = 0;
        const tpPlan = [];

        for (let i = 0; i < pos.takeProfits.length; i++) {
          const { price: oldPrice, sizePct, pct } = pos.takeProfits[i];

          // Визначаємо відсоткову дистанцію від старого entry, якщо pct не наданий
          let distPct = Number(pct);
          if (!Number.isFinite(distPct)) {
            if (side === 'LONG')
              distPct = ((oldPrice - entryPrice) / entryPrice) * 100;
            else distPct = ((entryPrice - oldPrice) / entryPrice) * 100;
          }

          // Нова ціна відносно avgEntry
          const targetPx =
            side === 'LONG'
              ? avgEntry * (1 + distPct / 100)
              : avgEntry * (1 - distPct / 100);

          // Кількість для TP
          const targetRaw = (totalQty * Number(sizePct || 0)) / 100;
          let tpQty;
          if (i === pos.takeProfits.length - 1) {
            const remainderRaw = Math.max(totalQty - allocated, 0);
            tpQty = Number(adjustQuantity(filters, remainderRaw));
          } else {
            tpQty = Number(adjustQuantity(filters, targetRaw));
          }

          if (!Number.isFinite(tpQty) || tpQty <= 0) continue;
          if (allocated + tpQty > totalQty)
            tpQty = Math.max(totalQty - allocated, 0);
          if (tpQty <= 0) continue;

          const tpPx = adjustPrice(filters, targetPx);
          const tpOrder = await placeTakeProfit(symbol, side, tpPx, tpQty);
          if (tpOrder?.orderId) orderIds.takes.push(tpOrder.orderId);
          allocated += tpQty;
          tpPlan.push({ price: tpPx, sizePct });
          console.log(
            `🎯 TP(realigned)#${i + 1} @ ${tpPx} for qty=${tpQty} (${Number(sizePct).toFixed(2)}%)`,
          );
        }

        await updateTakeProfits(symbol, tpPlan, avgEntry, 'OPEN_REALIGN');

        const diff = totalQty - allocated;
        if (diff > 0) console.log(`ℹ️ Unallocated qty after realign: ${diff}`);
      } catch (err) {
        console.warn(
          `⚠️ Failed to realign TP grid for ${symbol}:`,
          err?.message || err,
        );
      }
    }
  } catch (err) {
    console.warn(`⚠️ Realign check failed for ${symbol}:`, err?.message || err);
  }

  return pos;
}
