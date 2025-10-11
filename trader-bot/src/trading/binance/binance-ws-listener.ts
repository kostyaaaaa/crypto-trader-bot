import type { OrderTradeUpdateEvent, UserDataEvent } from '../../types/index';

// Helper: safe number parser
const n = (v: unknown): number => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};
// trading/binance/binance-ws-listener.ts
import axios from 'axios';
import WebSocket from 'ws';
import logger from '../../utils/db-logger';
import { notifyTrade } from '../../utils/notify';

import type { IPosition } from 'crypto-trader-db';
import { PositionModel } from 'crypto-trader-db';
import {
  closePositionHistory,
  getOpenPosition,
  updateStopPrice,
  updateTakeProfits,
} from '../core/history-store';
import {
  cancelAllOrders,
  cancelStopOrders,
  getPositionFresh,
  openMarketOrder,
  placeStopLoss,
} from './binance-functions/index';

import type { OrderSide, Side } from '../../types/index';

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

// --- Dedup storage for ORDER_TRADE_UPDATE events to avoid double-processing
const _processedOrderEvents: Map<string, number> = new Map(); // key -> ts
const DEDUP_TTL_MS = 5 * 60 * 1000; // 5 minutes
function isDuplicateOrderEvent(key: string): boolean {
  const now = Date.now();
  const ts = _processedOrderEvents.get(key);
  if (ts && now - ts < DEDUP_TTL_MS) return true;
  _processedOrderEvents.set(key, now);
  return false;
}

// --- Aggregate per-order fills to compute VWAP (avg price)
const _orderAgg: Map<number, { q: number; notional: number }> = new Map();

// --- Close context per symbol to accumulate PnL parts until flat
type CloseCtx = {
  entry: number;
  side: Side | null | undefined;
  tp: number; // realized from TPs
  sl: number; // realized from SL
  leftover: number; // realized from forced market close of remainder
  closed?: boolean;
};
const _closeCtx: Map<string, CloseCtx> = new Map();

function getCtx(
  symbol: string,
  entry: number,
  side: Side | null | undefined,
): CloseCtx {
  let c = _closeCtx.get(symbol);
  if (!c) {
    c = { entry, side, tp: 0, sl: 0, leftover: 0 };
    _closeCtx.set(symbol, c);
  }
  return c;
}

async function maybeFinalizeClose(symbol: string): Promise<boolean> {
  try {
    const live = (await getPositionFresh(symbol)) as {
      positionAmt?: string;
    } | null;
    const amt = live ? Math.abs(Number(live.positionAmt) || 0) : 0;
    if (amt > 0) return false; // still not flat

    const ctx = _closeCtx.get(symbol);
    if (!ctx || ctx.closed) return false;

    const finalGross = n(ctx.tp) + n(ctx.sl) + n(ctx.leftover);

    const closed = await closePositionHistory(symbol, { closedBy: 'SL' });
    await cancelAllOrders(symbol);
    // extra safety: if exchange already flat, this is a no-op
    await forceCloseIfLeftover(symbol);

    if (closed && Number.isFinite(finalGross)) {
      const pnlToSet = Math.round(n(finalGross) * 1e8) / 1e8;
      await PositionModel.findByIdAndUpdate(
        (closed as any)._id,
        { $set: { finalPnl: pnlToSet } },
        { new: true },
      );
      (closed as any).finalPnl = pnlToSet;
    }

    if (closed) {
      await notifyTrade(closed as any, 'CLOSED');
    }

    ctx.closed = true;
    _closeCtx.delete(symbol);
    return true;
  } catch (e) {
    logger.error(`❌ ${symbol}: finalize close failed:`, errMsg(e));
    return false;
  }
}

// -------------------------
// 1. Отримання listenKey
// -------------------------
async function getListenKey(): Promise<string | null> {
  try {
    const res = await axios.post(
      'https://fapi.binance.com/fapi/v1/listenKey',
      {},
      { headers: { 'X-MBX-APIKEY': process.env.BINANCE_API_KEY } },
    );
    return (res.data && (res.data as { listenKey?: string }).listenKey) || null;
  } catch (err) {
    logger.error('❌ Failed to get listenKey:', errMsg(err));
    return null;
  }
}

// -------------------------
// 2. Запуск WS стріму
// -------------------------
export async function startUserStream(): Promise<void> {
  const listenKey = await getListenKey();
  if (!listenKey) return;

  const wsUrl = `wss://fstream.binance.com/ws/${listenKey}`;
  const ws = new WebSocket(wsUrl);

  ws.on('open', () => {
    logger.info('🔌 Binance user stream connected');
  });

  ws.on('message', async (raw: WebSocket.RawData) => {
    try {
      const msg = JSON.parse(raw.toString()) as UserDataEvent;
      await handleEvent(msg);
    } catch (err) {
      logger.error('❌ WS message handling error:', errMsg(err));
    }
  });

  ws.on('close', () => {
    logger.info('⚠️ Binance user stream closed. Reconnecting...');
    setTimeout(() => void startUserStream(), 5000);
  });

  ws.on('error', (err) => {
    logger.error('❌ WS error:', errMsg(err));
    ws.close();
  });

  // оновлення listenKey раз на 25 хв
  setInterval(
    async () => {
      try {
        await axios.put(
          'https://fapi.binance.com/fapi/v1/listenKey',
          {},
          { headers: { 'X-MBX-APIKEY': process.env.BINANCE_API_KEY } },
        );
        logger.info('♻️ listenKey refreshed');
      } catch (err) {
        logger.error('❌ Failed to refresh listenKey:', errMsg(err));
      }
    },
    25 * 60 * 1000,
  );
}

// -------------------------
// 3. Автозакриття хвостів
// -------------------------
async function forceCloseIfLeftover(symbol: string): Promise<void> {
  try {
    // ⚠️ IMPORTANT: use fresh read to avoid cache staleness right after FILLED
    const live = (await getPositionFresh(symbol)) as {
      positionAmt?: string;
    } | null;
    if (!live) return;

    const amt = Number(live.positionAmt);
    if (!Number.isFinite(amt) || Math.abs(amt) === 0) return;

    const side = amt > 0 ? 'SELL' : 'BUY';
    await openMarketOrder(symbol, side, Math.abs(amt));
    logger.info(`🔧 Forced close leftover ${amt} on ${symbol}`);
  } catch (err) {
    logger.error(`❌ Failed to force close leftover ${symbol}:`, errMsg(err));
  }
}

// ---- PnL helpers (gross, excl. fees) ----
function calcFillPnl(
  entryPrice: number | string | null | undefined,
  fillPrice: number | string | null | undefined,
  qty: number | string | null | undefined,
  posSide: 'LONG' | 'SHORT' | null | undefined,
): number {
  const entry = n(entryPrice);
  const fill = n(fillPrice);
  const q = n(qty);
  if (!(entry > 0 && fill > 0 && q > 0)) return 0;
  const dir = posSide === 'LONG' ? 1 : -1;
  return (fill - entry) * q * dir;
}
function sumTpRealizedPnl(
  pos:
    | Pick<IPosition, 'takeProfits' | 'entryPrice' | 'side'>
    | null
    | undefined,
): number {
  if (!pos || !Array.isArray(pos.takeProfits)) return 0;
  let sum = 0;
  for (const tp of pos.takeProfits) {
    if (!tp || !Array.isArray((tp as any).fills)) continue;
    for (const f of (tp as any).fills as Array<{
      qty?: number | string;
      price?: number | string;
    }>) {
      sum += calcFillPnl(
        pos.entryPrice as number,
        f.price,
        f.qty,
        pos.side as any,
      );
    }
  }
  return sum;
}

// ---- TP cum helpers ----
function sumFillsQty(
  fills: Array<{ qty?: number | string }> | undefined,
): number {
  if (!Array.isArray(fills)) return 0;
  let s = 0;
  for (const f of fills) s += Number(f?.qty) || 0;
  return s;
}
function nextMonotonicCum(
  prevCum: number | string | undefined,
  evCum: number | string | undefined,
  deltaQty: number | string | undefined,
  fills: Array<{ qty?: number | string }> | undefined,
): number {
  const prev = Number(prevCum) || 0;
  const ev = Number(evCum);
  const hasEv = Number.isFinite(ev) && ev > 0;
  const sumF = sumFillsQty(fills);
  const candidate = hasEv ? ev : prev + (Number(deltaQty) || 0);
  return Math.max(prev, candidate, sumF);
}

// -------------------------
// 4. Обробка івентів
// -------------------------
async function handleEvent(msg: UserDataEvent): Promise<void> {
  switch (msg.e) {
    case 'ACCOUNT_UPDATE':
      break;

    case 'ORDER_TRADE_UPDATE': {
      const m = msg as OrderTradeUpdateEvent;

      const o = m.o;
      const symbol = o.s; // символ (наприклад "BTCUSDT")
      const status = o.X; // статус ордера (NEW, PARTIALLY_FILLED, FILLED, CANCELED...)
      const side = o.S; // BUY / SELL
      const type = o.ot; // тип ордера (MARKET, STOP_MARKET, TAKE_PROFIT_MARKET)
      const lastPx = Number(o.L); // ціна останньої угоди в рамках цього ордера
      const lastQty = Number(o.l); // кількість останньої угоди
      logger.info(
        `📦 Order update: ${symbol} ${side} status=${status}, type=${type}, lastPx=${lastPx}, lastQty=${lastQty}, orderId=${o.i}`,
      );

      // Aggregate fills for VWAP (avg execution price)
      if (Number.isFinite(lastPx) && Number.isFinite(lastQty) && lastQty > 0) {
        const agg = _orderAgg.get(o.i) || { q: 0, notional: 0 };
        agg.q += lastQty;
        agg.notional += lastPx * lastQty;
        _orderAgg.set(o.i, agg);
      }

      // Deduplicate identical updates (e.g., WS reconnects / repeats)
      const dedupKey = `${o.i}:${status}:${o.z || o.l || 0}:${m.T || m.E || ''}`;
      if (isDuplicateOrderEvent(dedupKey)) {
        logger.info(`↩️ Skipping duplicate order update ${dedupKey}`);
        break;
      }

      // Act only on FILLED; ignore NEW/EXPIRED/PARTIALLY_FILLED, etc.
      if (status !== 'FILLED') break;

      // Fetch current DB position once (before using `pos`)
      const pos = (await getOpenPosition(symbol)) as IPosition | null;

      if (!pos && (type === 'STOP_MARKET' || type === 'TAKE_PROFIT_MARKET')) {
        logger.warn(
          `⚠️ ${symbol}: FILLED ${type} but no OPEN position in DB. Skipping DB close; cleaning leftovers only.`,
        );
        await cancelAllOrders(symbol);
        await forceCloseIfLeftover(symbol);
        return;
      }

      // =======================
      // 🛑 Stop-loss (STOP_MARKET)
      // =======================
      if (type === 'STOP_MARKET') {
        logger.info(`🛑 ${symbol}: Stop-loss triggered`);
        if (pos) {
          // Оновлюємо ціну SL як "виконану"
          try {
            await updateStopPrice(symbol, lastPx, 'FILLED');
          } catch (err) {
            logger.error(
              `❌ ${symbol}: failed to update stop price:`,
              errMsg(err),
            );
          }

          // qty to close = cumulative filled for this SL order (o.z) or its quantity (o.q) or last fill (o.l)
          const agg = _orderAgg.get(o.i);
          const slFillQty = agg?.q || n(o.z) || n(o.q) || n(o.l);
          const avgPxFromAgg = agg && agg.q > 0 ? agg.notional / agg.q : 0;
          const avgPx =
            n((o as any).ap) ||
            (Number.isFinite(avgPxFromAgg) && avgPxFromAgg > 0
              ? avgPxFromAgg
              : lastPx);
          _orderAgg.delete(o.i);

          const slDelta = calcFillPnl(
            pos.entryPrice as number,
            avgPx,
            slFillQty,
            pos.side as any,
          );

          // total realized from TP so far
          const realizedFromTP = n(sumTpRealizedPnl(pos));

          logger.info(
            `🧮 ${symbol}: SL PnL parts — realizedFromTP=${realizedFromTP}, slDelta=${slDelta}, slQty=${slFillQty}, entry=${Number(pos.entryPrice) || 0}, avgPx=${avgPx}`,
          );

          // Зберігаємо контекст закриття, але НЕ закриваємо позицію поки не стане flat
          const ctx = getCtx(
            symbol,
            Number(pos.entryPrice) || 0,
            pos.side as any,
          );
          ctx.tp = realizedFromTP;
          ctx.sl += n(slDelta);

          // Спробуємо зберегти поточні TPs (щоб не втратити fills)
          try {
            await updateTakeProfits(
              symbol,
              Array.isArray(pos.takeProfits)
                ? pos.takeProfits.map((t) => ({ ...(t as any) }))
                : [],
              Number(pos.entryPrice) || 0,
              'SL_FILLED',
            );
          } catch (e) {
            logger.warn(
              `⚠️ ${symbol}: failed to persist TPs before SL close:`,
              errMsg(e),
            );
          }

          // Скасовуємо решту стопів/тейків і закриваємо хвіст, якщо залишився
          try {
            await cancelAllOrders(symbol);
          } catch {}
          await forceCloseIfLeftover(symbol);

          // Якщо позиція вже плоска — фіналізуємо, інакше дочекаємось MARKET-події по хвосту
          await maybeFinalizeClose(symbol);
        }
      }

      // =======================
      // 🎯 Take-profit (TAKE_PROFIT_MARKET)
      // =======================
      else if (type === 'TAKE_PROFIT_MARKET') {
        logger.info(`🎯 ${symbol}: Take-profit triggered`);
        if (pos && Array.isArray(pos.takeProfits)) {
          // Беремо копію поточних тейків
          const updatedTps = pos.takeProfits.map((tp) => ({ ...(tp as any) }));

          // Зчитуємо дані про останній трейд (qty/price/fee)
          const fillQty = Number(o.l) || 0; // last filled quantity
          const fillPx = Number(o.L) || 0; // last fill price
          const feeAmt = Number(o.n) || 0; // commission amount
          const feeAsset = o.N || null;
          const fillAt = new Date(m.E || Date.now()).toISOString();

          // Шукаємо тейк, який відповідає ціні (з невеликою похибкою)
          const tolerance = Math.max(
            0.01,
            Math.abs(Number(pos.entryPrice) * 0.001),
          ); // 0.1% або мін. 0.01
          let matched: any = null;
          for (const tp of updatedTps) {
            const tpPrice = Number((tp as any).price);
            // Дозволяємо дописувати часткові філи (кілька подій на один TP)
            const priceMatch =
              Number.isFinite(tpPrice) &&
              Math.abs(tpPrice - fillPx) <= tolerance;
            if (priceMatch) {
              if (!Array.isArray((tp as any).fills)) (tp as any).fills = [];
              // Використовуємо кумулятивну кількість з івента, щоб уникати дублю філів
              const evCum = Number(o.z);
              const prevCum = Number((tp as any).cum) || 0; // what we've already accounted for this TP
              const deltaQty =
                Number.isFinite(evCum) && evCum > 0
                  ? Math.max(0, evCum - prevCum)
                  : fillQty;
              // Оновлюємо лічильники на TP (монотонно)
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
              // Додаємо тільки дельту, якщо вона > 0
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
              // Позначаємо TP як виконаний (біржа повертає FILLED коли ордер добрав свій обсяг)
              // Важливо: позначаємо як filled навіть якщо deltaQty <= 0 (дублікат/out-of-order event)
              (tp as any).filled = true;
              matched = tp;
              break;
            }
          }

          if (!matched) {
            logger.warn(
              `⚠️ ${symbol}: TP fill received, but no matching TP by price (px=${fillPx}). Storing to the nearest TP.`,
            );
            // fallback: кидаємо у найближчий по ціні
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
              if (!Array.isArray((nearest as any).fills))
                (nearest as any).fills = [];
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
              // Позначаємо TP як виконаний навіть якщо deltaQty <= 0 (дублікат/out-of-order event)
              (nearest as any).filled = true;
            }
          }

          // Ensure cum never below sum of recorded fills (final guard)
          for (const tp of updatedTps) {
            const prev = Number((tp as any).cum) || 0;
            const fixed = Math.max(prev, sumFillsQty((tp as any).fills));
            if (fixed !== prev) (tp as any).cum = fixed;
          }

          try {
            // Оновлюємо список тейків у БД (з новими полями fills[])
            await updateTakeProfits(
              symbol,
              updatedTps as any,
              Number(pos.entryPrice),
              'TP_FILLED',
            );
          } catch (err) {
            logger.error(
              `❌ ${symbol}: failed to update take profits:`,
              errMsg(err),
            );
          }

          let allFilled = (updatedTps as any[]).every(
            (tp) => (tp as any).filled,
          );
          let liveAmtIsZero = false;
          if (!allFilled && type === 'TAKE_PROFIT_MARKET') {
            try {
              const live = (await getPositionFresh(symbol)) as {
                positionAmt?: string;
              } | null;
              const liveAmt = live
                ? Math.abs(Number(live.positionAmt) || 0)
                : 0;
              if (liveAmt === 0) {
                liveAmtIsZero = true;
                logger.info(
                  `🔍 ${symbol}: Live position is 0 after TP fill — will close without forcing other TPs to 'filled'`,
                );
              }
            } catch (err) {
              logger.warn(
                `⚠️ ${symbol}: Failed to check live position:`,
                errMsg(err),
              );
            }
          }

          logger.info(
            `🔍 ${symbol}: TP status check - allFilled=${allFilled}, filled TPs: ${updatedTps.filter((tp: any) => tp.filled).length}/${updatedTps.length}`,
          );

          if (allFilled || liveAmtIsZero) {
            // Calculate PnL from actual TP fills in the arrays
            const realizedFromTP = sumTpRealizedPnl({
              ...pos,
              takeProfits: updatedTps,
            } as IPosition);

            // If no fills were recorded (due to monotonic violations), calculate from current event
            let actualPnl = realizedFromTP;
            if (Math.abs(realizedFromTP) < 0.01) {
              // Calculate PnL from the current TP fill event
              const fillQty2 = Number(o.l) || 0; // last filled quantity
              const fillPx2 = Number(o.L) || 0; // last fill price
              const entry = Number(pos.entryPrice) || 0;
              const side2 = pos.side || 'LONG';

              if (fillQty2 > 0 && fillPx2 > 0 && entry > 0) {
                actualPnl = calcFillPnl(
                  entry,
                  fillPx2,
                  fillQty2,
                  side2 as Side,
                );
                logger.info(
                  `💰 ${symbol}: Calculated PnL from current event - qty=${fillQty2}, price=${fillPx2}, entry=${entry}, side=${side2}, pnl=${actualPnl}`,
                );
              } else {
                logger.warn(
                  `⚠️ ${symbol}: Cannot calculate PnL from event - qty=${fillQty2}, price=${fillPx2}, entry=${entry}`,
                );
              }
            }

            logger.info(
              `💰 ${symbol}: Final TP PnL: ${actualPnl} (from fills: ${realizedFromTP})`,
            );

            try {
              // Спочатку — оновимо TPs у БД остаточним станом
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

              const closed = await closePositionHistory(symbol, {
                closedBy: 'TP',
              });
              logger.info(`✅ ${symbol}: Position closed in DB: ${!!closed}`);

              // Update the finalPnl after closing to ensure correct PnL is stored
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
                logger.warn(
                  `⚠️ ${symbol}: Position closure returned null/undefined`,
                );
              }
            } catch (err) {
              logger.error(
                `❌ ${symbol}: failed to close position:`,
                errMsg(err),
              );
            }
          } else {
            logger.info(
              `⏳ ${symbol}: Not all TPs filled yet, position remains open`,
            );
          }

          // ===== BREAK-EVEN після першого TP — ставимо тільки якщо трейлінг ВИМКНЕНО =====
          try {
            const tpsTotal = updatedTps.length;
            const filledCount = updatedTps.filter(
              (tp: any) => tp.filled,
            ).length;
            const trailingOn = !!(
              (pos as any)?.trailing || (pos as any)?.trailingCfg?.use
            );

            if (!trailingOn && tpsTotal >= 2 && filledCount === 1) {
              // перевіряємо поточну live-кількість на біржі
              const live = (await getPositionFresh(symbol)) as {
                positionAmt?: string;
              } | null;
              const liveAmt = live
                ? Math.abs(Number(live.positionAmt) || 0)
                : 0;

              logger.info(
                `🔎 ${symbol}: BE check — liveAmt=${liveAmt}, filledCount=${filledCount}/${tpsTotal}, trailingOn=${trailingOn}`,
              );

              if (liveAmt > 0) {
                // скасовуємо лише SL (TP не чіпаємо)
                try {
                  await cancelStopOrders(symbol, { onlySL: true });
                } catch {}

                // break-even ціна = entryPrice
                const bePrice = Number(pos.entryPrice);

                // ставимо новий SL на entry для залишкового обсягу
                await placeStopLoss(
                  symbol,
                  pos.side as Side | OrderSide,
                  bePrice,
                  liveAmt,
                );

                // логімо в історію
                await updateStopPrice(symbol, bePrice, 'BREAKEVEN');

                logger.info(
                  `🟩 ${symbol}: BE set at entry after 1st TP (qty=${liveAmt})`,
                );
              }
            }
          } catch (e) {
            logger.warn(
              `⚠️ ${symbol}: failed to set BE after 1st TP:`,
              errMsg(e),
            );
          }
          // Інакше — позиція залишається відкритою (частковий TP)
        }
      }

      // =======================
      // ✅ MARKET (звичайний маркет ордер, відкриття/закриття)
      // =======================
      else if (type === 'MARKET') {
        logger.info(`✅ Market order filled for ${symbol} (${side})`);
        // Якщо ми в процесі закриття після SL — дорахуємо PnL по "хвосту" (leftover)
        const ctx = _closeCtx.get(symbol);
        if (ctx && !ctx.closed) {
          const agg = _orderAgg.get(o.i);
          const execQty = agg?.q || n(o.z) || n(o.q) || n(o.l);
          const avgPxFromAgg = agg && agg.q > 0 ? agg.notional / agg.q : 0;
          const avgPx =
            n((o as any).ap) ||
            (Number.isFinite(avgPxFromAgg) && avgPxFromAgg > 0
              ? avgPxFromAgg
              : lastPx);
          _orderAgg.delete(o.i);

          if (execQty > 0 && avgPx > 0) {
            const delta = calcFillPnl(
              ctx.entry,
              avgPx,
              execQty,
              ctx.side as any,
            );
            ctx.leftover += n(delta);
            logger.info(
              `➕ ${symbol}: leftover PnL += ${delta} (qty=${execQty}, avgPx=${avgPx})`,
            );
          }

          await maybeFinalizeClose(symbol);
        }
        // Інакше: це не наш сценарій закриття — ігноруємо
      }
      break;
    }

    default:
    // 🔹 Якщо прийшов інший івент, ми його ігноруємо.
  }
}
