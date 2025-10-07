// trading/binance/ws-listener.js
import axios from 'axios';
import WebSocket from 'ws';
import logger from '../../utils/db-logger.js';
import { notifyTrade } from '../../utils/notify.js';

import { PositionModel } from 'crypto-trader-db';
import {
  closePositionHistory,
  getOpenPosition,
  updateStopPrice,
  updateTakeProfits,
} from '../core/historyStore.js';
import {
  cancelAllOrders,
  cancelStopOrders,
  getPositionFresh,
  openMarketOrder,
  placeStopLoss,
} from './binance.js';

// --- Dedup storage for ORDER_TRADE_UPDATE events to avoid double-processing
const _processedOrderEvents = new Map(); // key -> ts
const DEDUP_TTL_MS = 5 * 60 * 1000; // 5 minutes
function isDuplicateOrderEvent(key) {
  const now = Date.now();
  const ts = _processedOrderEvents.get(key);
  if (ts && now - ts < DEDUP_TTL_MS) return true;
  _processedOrderEvents.set(key, now);
  return false;
}

// -------------------------
// 1. Отримання listenKey
// -------------------------
async function getListenKey() {
  try {
    const res = await axios.post(
      'https://fapi.binance.com/fapi/v1/listenKey',
      {},
      { headers: { 'X-MBX-APIKEY': process.env.BINANCE_API_KEY } },
    );
    return res.data.listenKey;
  } catch (err) {
    logger.error('❌ Failed to get listenKey:', err.message);
    return null;
  }
}

// -------------------------
// 2. Запуск WS стріму
// -------------------------
export async function startUserStream() {
  const listenKey = await getListenKey();
  if (!listenKey) return;

  const wsUrl = `wss://fstream.binance.com/ws/${listenKey}`;
  const ws = new WebSocket(wsUrl);

  ws.on('open', () => {
    logger.info('🔌 Binance user stream connected');
  });

  ws.on('message', async (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      await handleEvent(msg);
    } catch (err) {
      logger.error('❌ WS message handling error:', err?.message || err);
    }
  });

  ws.on('close', () => {
    logger.info('⚠️ Binance user stream closed. Reconnecting...');
    setTimeout(() => startUserStream(), 5000);
  });

  ws.on('error', (err) => {
    logger.error('❌ WS error:', err.message);
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
        logger.error('❌ Failed to refresh listenKey:', err.message);
      }
    },
    25 * 60 * 1000,
  );
}

// -------------------------
// 3. Автозакриття хвостів
// -------------------------
async function forceCloseIfLeftover(symbol) {
  try {
    // ⚠️ IMPORTANT: use fresh read to avoid cache staleness right after FILLED
    const live = await getPositionFresh(symbol);
    if (!live) return;

    const amt = Number(live.positionAmt);
    if (!Number.isFinite(amt) || Math.abs(amt) === 0) return;

    const side = amt > 0 ? 'SELL' : 'BUY';
    await openMarketOrder(symbol, side, Math.abs(amt));
    logger.info(`🔧 Forced close leftover ${amt} on ${symbol}`);
  } catch (err) {
    logger.error(`❌ Failed to force close leftover ${symbol}:`, err.message);
  }
}

// ---- PnL helpers (gross, excl. fees) ----
function calcFillPnl(entryPrice, fillPrice, qty, posSide) {
  const dir = posSide === 'LONG' ? 1 : -1;
  return (fillPrice - entryPrice) * qty * dir;
}
function sumTpRealizedPnl(pos) {
  if (!pos || !Array.isArray(pos.takeProfits)) return 0;
  const entry = Number(pos.entryPrice) || 0;
  const side = pos.side || 'LONG';
  let sum = 0;
  for (const tp of pos.takeProfits) {
    if (!tp || !Array.isArray(tp.fills)) continue;
    for (const f of tp.fills) {
      const qty = Number(f.qty) || 0;
      const price = Number(f.price) || 0;
      if (qty > 0 && Number.isFinite(price)) {
        sum += calcFillPnl(entry, price, qty, side);
      }
    }
  }
  return sum;
}

// ---- TP cum helpers ----
function sumFillsQty(fills) {
  if (!Array.isArray(fills)) return 0;
  let s = 0;
  for (const f of fills) s += Number(f?.qty) || 0;
  return s;
}
function nextMonotonicCum(prevCum, evCum, deltaQty, fills) {
  const prev = Number(prevCum) || 0;
  const ev = Number(evCum);
  const hasEv = Number.isFinite(ev) && ev > 0;
  const sumF = sumFillsQty(fills);
  const candidate = hasEv ? ev : prev + (Number(deltaQty) || 0);
  // never allow cum to shrink; also never below sum of recorded fills
  return Math.max(prev, candidate, sumF);
}

// -------------------------
// 4. Обробка івентів
// -------------------------
async function handleEvent(msg) {
  switch (msg.e) {
    case 'ACCOUNT_UPDATE':
      // 🔹 Тут обробляються події акаунта (баланс, маржа, зміни у wallet).
      // Зараз нічого не робимо, але можна додати логіку оновлення балансу.
      break;

    case 'ORDER_TRADE_UPDATE': {
      // 🔹 Це основний івент про статус ордерів (Binance Futures).
      // Викликається коли:
      //   - ордер частково або повністю виконаний,
      //   - спрацював SL / TP,
      //   - ордер відмінено тощо.

      const o = msg.o;
      const symbol = o.s; // символ (наприклад "BTCUSDT")
      const status = o.X; // статус ордера (NEW, PARTIALLY_FILLED, FILLED, CANCELED...)
      const side = o.S; // BUY / SELL
      const type = o.ot; // тип ордера (MARKET, STOP_MARKET, TAKE_PROFIT_MARKET)
      const lastPx = Number(o.L); // ціна останньої угоди в рамках цього ордера
      const lastQty = Number(o.l); // кількість останньої угоди
      logger.info(
        `📦 Order update: ${symbol} ${side} status=${status}, type=${type}, lastPx=${lastPx}, lastQty=${lastQty}, orderId=${o.i}`,
      );

      // Deduplicate identical updates (e.g., WS reconnects / repeats)
      const dedupKey = `${o.i}:${status}:${o.z || o.l || 0}:${msg.T || msg.E || ''}`;
      if (isDuplicateOrderEvent(dedupKey)) {
        logger.info(`↩️ Skipping duplicate order update ${dedupKey}`);
        break;
      }

      // Act only on FILLED; ignore NEW/EXPIRED/PARTIALLY_FILLED, etc.
      if (status !== 'FILLED') break;

      // Fetch current DB position once (before using `pos`)
      const pos = await getOpenPosition(symbol);

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
              err?.message || err,
            );
          }

          // Рахуємо фінальний PnL:
          // 1) що вже реалізовано на попередніх TP філах
          const realizedFromTP = sumTpRealizedPnl(pos);
          // 2) дельта від поточного SL-філа (за lastQty/lastPx)
          //    Примітка: side з позиції, qty = o.l
          // Use cumulative filled qty if available (`o.z`), fallback to order qty `o.q` or last fill `o.l`
          const slFillQty = Number(o.z) || Number(o.q) || Number(o.l) || 0;
          const slDelta = calcFillPnl(
            Number(pos.entryPrice) || 0,
            lastPx,
            slFillQty,
            pos.side || 'LONG',
          );
          const finalGrossPnl =
            (Number.isFinite(realizedFromTP) ? realizedFromTP : 0) +
            (Number.isFinite(slDelta) ? slDelta : 0);

          logger.info(
            `🧮 ${symbol}: SL close PnL parts — realizedFromTP=${realizedFromTP}, slDelta=${slDelta}, slQty=${slFillQty}, entry=${Number(pos.entryPrice) || 0}, lastPx=${lastPx}`,
          );

          try {
            // Перед закриттям — збережемо поточний стан TPs (щоб другі/треті не зникали)
            try {
              await updateTakeProfits(
                symbol,
                Array.isArray(pos.takeProfits)
                  ? pos.takeProfits.map((t) => ({ ...t }))
                  : [],
                Number(pos.entryPrice) || 0,
                'SL_FILLED',
              );
            } catch (e) {
              logger.warn(
                `⚠️ ${symbol}: failed to persist TPs before SL close:`,
                e?.message || e,
              );
            }

            // Закриваємо позицію в історії з фінальним PnL
            const closed = await closePositionHistory(symbol, {
              closedBy: 'SL',
              finalPnl: Number.isFinite(finalGrossPnl)
                ? Number(finalGrossPnl.toFixed(4))
                : undefined,
            });
            // Чистимо залишки
            await cancelAllOrders(symbol);
            await forceCloseIfLeftover(symbol);

            // Відправляємо нотифікацію
            if (closed) {
              await notifyTrade(closed, 'CLOSED');
            }
          } catch (err) {
            logger.error(
              `❌ ${symbol}: failed to close position:`,
              err?.message || err,
            );
          }
        }
      }

      // =======================
      // 🎯 Take-profit (TAKE_PROFIT_MARKET)
      // =======================
      else if (type === 'TAKE_PROFIT_MARKET') {
        logger.info(`🎯 ${symbol}: Take-profit triggered`);
        if (pos && Array.isArray(pos.takeProfits)) {
          // Беремо копію поточних тейків
          const updatedTps = pos.takeProfits.map((tp) => ({ ...tp }));

          // Зчитуємо дані про останній трейд (qty/price/fee)
          const fillQty = Number(o.l) || 0; // last filled quantity
          const fillPx = Number(o.L) || 0; // last fill price
          const feeAmt = Number(o.n) || 0; // commission amount
          const feeAsset = o.N || null;
          const fillAt = new Date(msg.E || Date.now()).toISOString();

          // Шукаємо тейк, який відповідає ціні (з невеликою похибкою)
          const tolerance = Math.max(0.01, Math.abs(pos.entryPrice * 0.001)); // 0.1% або мін. 0.01
          let matched = null;
          for (const tp of updatedTps) {
            const tpPrice = Number(tp.price);
            // Дозволяємо дописувати часткові філи (кілька подій на один TP)
            const priceMatch =
              Number.isFinite(tpPrice) &&
              Math.abs(tpPrice - fillPx) <= tolerance;
            if (priceMatch) {
              if (!Array.isArray(tp.fills)) tp.fills = [];
              // Використовуємо кумулятивну кількість з івента, щоб уникати дублю філів
              const evCum = Number(o.z);
              const prevCum = Number(tp.cum) || 0; // what we've already accounted for this TP
              const deltaQty =
                Number.isFinite(evCum) && evCum > 0
                  ? Math.max(0, evCum - prevCum)
                  : fillQty;
              // Оновлюємо лічильники на TP (монотонно)
              const before = prevCum;
              tp.cum = nextMonotonicCum(prevCum, evCum, deltaQty, tp.fills);
              if (Number.isFinite(evCum) && evCum > 0 && evCum < before) {
                logger.warn(
                  `↪️ ${symbol}: TP o.z(${evCum}) < prevCum(${before}) — keeping monotonic cum=${tp.cum}`,
                );
              }
              tp.orderId = tp.orderId || o.i;
              // Додаємо тільки дельту, якщо вона > 0
              if (deltaQty > 0) {
                tp.fills.push({
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
              tp.filled = true;
              matched = tp;
              break;
            }
          }

          if (!matched) {
            logger.warn(
              `⚠️ ${symbol}: TP fill received, but no matching TP by price (px=${fillPx}). Storing to the nearest TP.`,
            );
            // fallback: кидаємо у найближчий по ціні
            let nearest = null;
            let best = Infinity;
            for (const tp of updatedTps || []) {
              const tpPriceNum = Number(tp?.price);
              if (!Number.isFinite(tpPriceNum)) continue;
              const d = Math.abs(tpPriceNum - fillPx);
              if (d < best) {
                best = d;
                nearest = tp;
              }
            }
            if (nearest) {
              if (!Array.isArray(nearest.fills)) nearest.fills = [];
              const evCum = Number(o.z);
              const prevCum = Number(nearest.cum) || 0;
              const deltaQty =
                Number.isFinite(evCum) && evCum > 0
                  ? Math.max(0, evCum - prevCum)
                  : fillQty;
              const before = prevCum;
              nearest.cum = nextMonotonicCum(
                prevCum,
                evCum,
                deltaQty,
                nearest.fills,
              );
              if (Number.isFinite(evCum) && evCum > 0 && evCum < before) {
                logger.warn(
                  `↪️ ${symbol}: TP(nearest) o.z(${evCum}) < prevCum(${before}) — keeping monotonic cum=${nearest.cum}`,
                );
              }
              nearest.orderId = nearest.orderId || o.i;
              if (deltaQty > 0) {
                nearest.fills.push({
                  qty: deltaQty,
                  price: fillPx,
                  time: fillAt,
                  fee: feeAmt,
                  feeAsset,
                });
              }
              // Позначаємо TP як виконаний навіть якщо deltaQty <= 0 (дублікат/out-of-order event)
              nearest.filled = true;
            }
          }

          // Ensure cum never below sum of recorded fills (final guard)
          for (const tp of updatedTps) {
            const prev = Number(tp.cum) || 0;
            const fixed = Math.max(prev, sumFillsQty(tp.fills));
            if (fixed !== prev) tp.cum = fixed;
          }

          try {
            // Оновлюємо список тейків у БД (з новими полями fills[])
            await updateTakeProfits(
              symbol,
              updatedTps,
              pos.entryPrice,
              'TP_FILLED',
            );
          } catch (err) {
            logger.error(
              `❌ ${symbol}: failed to update take profits:`,
              err?.message || err,
            );
          }

          // Додаткова перевірка: якщо отримали FILLED event, але не всі TP позначені як filled,
          // можливо це означає що всі TP ордери виконані, але через дублікати/out-of-order events
          // не всі були оброблені. Перевіряємо live позицію.
          let allFilled = updatedTps.every((tp) => tp.filled);
          let liveAmtIsZero = false;
          if (!allFilled && type === 'TAKE_PROFIT_MARKET') {
            try {
              const live = await getPositionFresh(symbol);
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
                err?.message || err,
              );
            }
          }

          logger.info(
            `🔍 ${symbol}: TP status check - allFilled=${allFilled}, filled TPs: ${updatedTps.filter((tp) => tp.filled).length}/${updatedTps.length}`,
          );

          if (allFilled || liveAmtIsZero) {
            // Calculate PnL from actual TP fills in the arrays
            const realizedFromTP = sumTpRealizedPnl({
              ...pos,
              takeProfits: updatedTps,
            });

            // If no fills were recorded (due to monotonic violations), calculate from current event
            let actualPnl = realizedFromTP;
            if (Math.abs(realizedFromTP) < 0.01) {
              // Calculate PnL from the current TP fill event
              const fillQty = Number(o.l) || 0; // last filled quantity
              const fillPx = Number(o.L) || 0; // last fill price
              const entry = Number(pos.entryPrice) || 0;
              const side = pos.side || 'LONG';

              if (fillQty > 0 && fillPx > 0 && entry > 0) {
                actualPnl = calcFillPnl(entry, fillPx, fillQty, side);
                logger.info(
                  `💰 ${symbol}: Calculated PnL from current event - qty=${fillQty}, price=${fillPx}, entry=${entry}, side=${side}, pnl=${actualPnl}`,
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
              // Спочатку — оновимо TPs у БД остаточним станом
              try {
                await updateTakeProfits(
                  symbol,
                  updatedTps.map((t) => ({ ...t })),
                  Number(pos.entryPrice) || 0,
                  'TP_FILLED_FINAL',
                );
              } catch (e) {
                logger.warn(
                  `⚠️ ${symbol}: failed to persist final TPs before TP close:`,
                  e?.message || e,
                );
              }

              const closed = await closePositionHistory(symbol, {
                closedBy: 'TP',
              });
              logger.info(`✅ ${symbol}: Position closed in DB: ${!!closed}`);

              // Update the finalPnl after closing to ensure correct PnL is stored
              if (closed && Number.isFinite(actualPnl) && actualPnl !== 0) {
                await PositionModel.findByIdAndUpdate(
                  closed._id,
                  { $set: { finalPnl: Number(actualPnl.toFixed(8)) } },
                  { new: true },
                );
                logger.info(
                  `💾 ${symbol}: Updated finalPnl to ${actualPnl.toFixed(8)}`,
                );

                // Update the closed object for notification
                closed.finalPnl = Number(actualPnl.toFixed(8));
              }

              await cancelAllOrders(symbol);
              await forceCloseIfLeftover(symbol);
              if (closed) {
                await notifyTrade(closed, 'CLOSED');
                logger.info(`📱 ${symbol}: Telegram notification sent`);
              } else {
                logger.warn(
                  `⚠️ ${symbol}: Position closure returned null/undefined`,
                );
              }
            } catch (err) {
              logger.error(
                `❌ ${symbol}: failed to close position:`,
                err?.message || err,
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
            const filledCount = updatedTps.filter((tp) => tp.filled).length;
            const trailingOn = !!(pos?.trailing || pos?.trailingCfg?.use);

            if (!trailingOn && tpsTotal >= 2 && filledCount === 1) {
              // перевіряємо поточну live-кількість на біржі
              const live = await getPositionFresh(symbol);
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
                await placeStopLoss(symbol, pos.side, bePrice, liveAmt);

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
              e?.message || e,
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
        // Тут можна обробити логіку відкриття нової позиції або закриття вручну
      }
    }

    default:
    // 🔹 Якщо прийшов інший івент, ми його ігноруємо.
  }
}
