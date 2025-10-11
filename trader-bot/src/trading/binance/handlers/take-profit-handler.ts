import type { IPosition } from 'crypto-trader-db';
import { PositionModel } from 'crypto-trader-db';
import type {
  OrderSide,
  OrderTradeUpdateEvent,
  Side,
} from '../../../types/index';
import logger from '../../../utils/db-logger';
import { notifyTrade } from '../../../utils/notify';
import {
  closePositionHistory,
  updateStopPrice,
  updateTakeProfits,
} from '../../core/history-store';
import {
  cancelAllOrders,
  cancelStopOrders,
  getPositionFresh,
  placeStopLoss,
} from '../binance-functions/index';
import { nextMonotonicCum, sumFillsQty } from '../helpers/fill-aggregator';
import { forceCloseIfLeftover } from '../helpers/force-close';
import { calcFillPnl, n, sumTpRealizedPnl } from '../helpers/pnl-calculator';

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * Handle TAKE_PROFIT_MARKET order fill
 */
export async function handleTakeProfit(
  m: OrderTradeUpdateEvent,
  pos: IPosition | null,
): Promise<void> {
  const o = m.o;
  const symbol = o.s;
  const fillQty = Number(o.l) || 0;
  const fillPx = Number(o.L) || 0;
  const feeAmt = Number(o.n) || 0;
  const feeAsset = o.N || null;
  const fillAt = new Date(m.E || Date.now()).toISOString();

  logger.info(`🎯 ${symbol}: Take-profit triggered`);

  if (!pos || !Array.isArray(pos.takeProfits)) {
    logger.warn(`⚠️ ${symbol}: FILLED TP but no position or TPs in DB`);
    await cancelAllOrders(symbol);
    await forceCloseIfLeftover(symbol);
    return;
  }

  // Copy current TPs
  const updatedTps = pos.takeProfits.map((tp) => ({ ...(tp as any) }));

  // Find matching TP by price
  const tolerance = Math.max(0.01, Math.abs(Number(pos.entryPrice) * 0.001));
  let matched: any = null;

  for (const tp of updatedTps) {
    const tpPrice = Number((tp as any).price);
    const priceMatch =
      Number.isFinite(tpPrice) && Math.abs(tpPrice - fillPx) <= tolerance;

    if (priceMatch) {
      if (!Array.isArray((tp as any).fills)) (tp as any).fills = [];

      const evCum = Number(o.z);
      const prevCum = Number((tp as any).cum) || 0;
      const deltaQty =
        Number.isFinite(evCum) && evCum > 0
          ? Math.max(0, evCum - prevCum)
          : fillQty;

      const before = prevCum;
      (tp as any).cum = nextMonotonicCum(
        prevCum,
        evCum,
        deltaQty,
        (tp as any).fills,
      );

      if (Number.isFinite(evCum) && evCum > 0 && evCum < before) {
        logger.warn(
          `↪️ ${symbol}: TP o.z(${evCum}) < prevCum(${before}) — keeping monotonic cum=${(tp as any).cum}`,
        );
      }

      (tp as any).orderId = (tp as any).orderId || o.i;

      if (deltaQty > 0) {
        (tp as any).fills.push({
          qty: deltaQty,
          price: fillPx,
          time: fillAt,
          fee: feeAmt,
          feeAsset,
        });
        logger.info(
          `📝 ${symbol}: Added TP fill - qty=${deltaQty}, price=${fillPx}`,
        );
      } else {
        logger.info(
          `🔄 ${symbol}: deltaQty=${deltaQty} (monotonic violation), no fill added but TP marked as filled`,
        );
      }

      (tp as any).filled = true;
      matched = tp;
      break;
    }
  }

  // Fallback: find nearest TP by price
  if (!matched) {
    logger.warn(
      `⚠️ ${symbol}: TP fill received, but no matching TP by price (px=${fillPx}). Storing to the nearest TP.`,
    );

    let nearest: any = null;
    let best = Infinity;

    for (const tp of updatedTps || []) {
      const tpPriceNum = Number((tp as any)?.price);
      if (!Number.isFinite(tpPriceNum)) continue;
      const d = Math.abs(tpPriceNum - fillPx);
      if (d < best) {
        best = d;
        nearest = tp;
      }
    }

    if (nearest) {
      if (!Array.isArray((nearest as any).fills)) (nearest as any).fills = [];

      const evCum = Number(o.z);
      const prevCum = Number((nearest as any).cum) || 0;
      const deltaQty =
        Number.isFinite(evCum) && evCum > 0
          ? Math.max(0, evCum - prevCum)
          : fillQty;

      const before = prevCum;
      (nearest as any).cum = nextMonotonicCum(
        prevCum,
        evCum,
        deltaQty,
        (nearest as any).fills,
      );

      if (Number.isFinite(evCum) && evCum > 0 && evCum < before) {
        logger.warn(
          `↪️ ${symbol}: TP(nearest) o.z(${evCum}) < prevCum(${before}) — keeping monotonic cum=${(nearest as any).cum}`,
        );
      }

      (nearest as any).orderId = (nearest as any).orderId || o.i;

      if (deltaQty > 0) {
        (nearest as any).fills.push({
          qty: deltaQty,
          price: fillPx,
          time: fillAt,
          fee: feeAmt,
          feeAsset,
        });
      }

      (nearest as any).filled = true;
    }
  }

  // Ensure cum never below sum of recorded fills
  for (const tp of updatedTps) {
    const prev = Number((tp as any).cum) || 0;
    const fixed = Math.max(prev, sumFillsQty((tp as any).fills));
    if (fixed !== prev) (tp as any).cum = fixed;
  }

  // Update TPs in DB
  try {
    await updateTakeProfits(
      symbol,
      updatedTps as any,
      Number(pos.entryPrice),
      'TP_FILLED',
    );
  } catch (err) {
    logger.error(`❌ ${symbol}: failed to update take profits:`, errMsg(err));
  }

  // Check if all TPs are filled or position is flat
  let allFilled = (updatedTps as any[]).every((tp) => (tp as any).filled);
  let liveAmtIsZero = false;

  if (!allFilled) {
    try {
      const live = (await getPositionFresh(symbol)) as {
        positionAmt?: string;
      } | null;
      const liveAmt = live ? Math.abs(Number(live.positionAmt) || 0) : 0;
      if (liveAmt === 0) {
        liveAmtIsZero = true;
        logger.info(
          `🔍 ${symbol}: Live position is 0 after TP fill — will close without forcing other TPs to 'filled'`,
        );
      }
    } catch (err) {
      logger.warn(`⚠️ ${symbol}: Failed to check live position:`, errMsg(err));
    }
  }

  logger.info(
    `🔍 ${symbol}: TP status check - allFilled=${allFilled}, filled TPs: ${updatedTps.filter((tp: any) => tp.filled).length}/${updatedTps.length}`,
  );

  // If all TPs filled or position flat, close position
  if (allFilled || liveAmtIsZero) {
    const realizedFromTP = sumTpRealizedPnl({
      ...pos,
      takeProfits: updatedTps,
    } as IPosition);

    let actualPnl = realizedFromTP;
    if (Math.abs(realizedFromTP) < 0.01) {
      const entry = Number(pos.entryPrice) || 0;
      const side2 = pos.side || 'LONG';

      if (fillQty > 0 && fillPx > 0 && entry > 0) {
        actualPnl = calcFillPnl(entry, fillPx, fillQty, side2 as Side);
        logger.info(
          `💰 ${symbol}: Calculated PnL from current event - qty=${fillQty}, price=${fillPx}, entry=${entry}, side=${side2}, pnl=${actualPnl}`,
        );
      } else {
        logger.warn(
          `⚠️ ${symbol}: Cannot calculate PnL from event - qty=${fillQty}, price=${fillPx}, entry=${entry}`,
        );
      }
    }

    logger.info(
      `💰 ${symbol}: Final TP PnL: ${actualPnl} (from fills: ${realizedFromTP})`,
    );

    try {
      // Update TPs with final state
      try {
        await updateTakeProfits(
          symbol,
          updatedTps.map((t) => ({ ...(t as any) })),
          Number(pos.entryPrice) || 0,
          'TP_FILLED_FINAL',
        );
      } catch (e) {
        logger.warn(
          `⚠️ ${symbol}: failed to persist final TPs before TP close:`,
          errMsg(e),
        );
      }

      const closed = await closePositionHistory(symbol, { closedBy: 'TP' });
      logger.info(`✅ ${symbol}: Position closed in DB: ${!!closed}`);

      // Update finalPnl
      const rounded = Math.round(n(actualPnl) * 1e8) / 1e8;
      if (closed && Number.isFinite(rounded) && rounded !== 0) {
        await PositionModel.findByIdAndUpdate(
          (closed as any)._id,
          { $set: { finalPnl: rounded } },
          { new: true },
        );
        logger.info(`💾 ${symbol}: Updated finalPnl to ${rounded}`);
        (closed as any).finalPnl = rounded;
      }

      await cancelAllOrders(symbol);
      await forceCloseIfLeftover(symbol);

      if (closed) {
        await notifyTrade(closed as any, 'CLOSED');
        logger.info(`📱 ${symbol}: Telegram notification sent`);
      } else {
        logger.warn(`⚠️ ${symbol}: Position closure returned null/undefined`);
      }
    } catch (err) {
      logger.error(`❌ ${symbol}: failed to close position:`, errMsg(err));
    }
  } else {
    logger.info(`⏳ ${symbol}: Not all TPs filled yet, position remains open`);
  }

  // Break-even after first TP (only if trailing is OFF)
  await handleBreakEven(symbol, pos, updatedTps);
}

/**
 * Set break-even stop after first TP is filled (if trailing is disabled)
 */
async function handleBreakEven(
  symbol: string,
  pos: IPosition,
  updatedTps: any[],
): Promise<void> {
  try {
    const tpsTotal = updatedTps.length;
    const filledCount = updatedTps.filter((tp: any) => tp.filled).length;
    const trailingOn = !!(
      (pos as any)?.trailing || (pos as any)?.trailingCfg?.use
    );

    if (!trailingOn && tpsTotal >= 2 && filledCount === 1) {
      const live = (await getPositionFresh(symbol)) as {
        positionAmt?: string;
      } | null;
      const liveAmt = live ? Math.abs(Number(live.positionAmt) || 0) : 0;

      logger.info(
        `🔎 ${symbol}: BE check — liveAmt=${liveAmt}, filledCount=${filledCount}/${tpsTotal}, trailingOn=${trailingOn}`,
      );

      if (liveAmt > 0) {
        try {
          await cancelStopOrders(symbol, { onlySL: true });
        } catch {}

        const bePrice = Number(pos.entryPrice);
        await placeStopLoss(
          symbol,
          pos.side as Side | OrderSide,
          bePrice,
          liveAmt,
        );
        await updateStopPrice(symbol, bePrice, 'BREAKEVEN');

        logger.info(
          `🟩 ${symbol}: BE set at entry after 1st TP (qty=${liveAmt})`,
        );
      }
    }
  } catch (e) {
    logger.warn(`⚠️ ${symbol}: failed to set BE after 1st TP:`, errMsg(e));
  }
}
