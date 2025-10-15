import axios from 'axios';
import crypto from 'crypto';
import { PositionModel, type IPosition } from 'crypto-trader-db';
import 'dotenv/config';
import { Types } from 'mongoose';
import logger from '../../utils/db-logger';
import notifyTrade from '../../utils/notify';
import { cancelAllOrders } from './binance-functions/index';

const BINANCE_BASE = 'https://fapi.binance.com';

// --- rate-limit & time helpers ---
let _timeOffsetMs = 0; // Binance serverTime - local Date.now()
let _lastTimeSync = 0;
const TIME_SYNC_TTL = 5 * 60 * 1000; // 5m

async function syncServerTime() {
  try {
    const { data } = await axios.get<{ serverTime: number }>(
      `${BINANCE_BASE}/fapi/v1/time`,
      { timeout: 5000 },
    );
    _timeOffsetMs = Number(data?.serverTime || 0) - Date.now();
    _lastTimeSync = Date.now();
  } catch (e) {
    // do not throw, just log; we'll try again next call
    logger.warn('⚠️ Failed to sync Binance server time');
  }
}

function withRecvWindow(params: Record<string, any> = {}) {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(params || {})) {
    if (v !== undefined && v !== null) out[k] = String(v);
  }
  // default recvWindow if not provided
  if (!('recvWindow' in out)) out.recvWindow = String(10_000);
  return out;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function sign(query: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(query).digest('hex');
}

async function binanceGet<T>(
  path: string,
  params: Record<string, any> = {},
): Promise<T> {
  const apiKey = process.env.BINANCE_API_KEY || '';
  const apiSecret = process.env.BINANCE_ACCOUNT_SECRET_KEY || '';
  if (!apiKey || !apiSecret)
    throw new Error(
      'BINANCE_API_KEY / BINANCE_ACCOUNT_SECRET_KEY are required',
    );

  // keep server time in sync to avoid timestamp / recvWindow issues
  if (Date.now() - _lastTimeSync > TIME_SYNC_TTL) {
    await syncServerTime();
  }

  const timestamp = Date.now() + _timeOffsetMs;
  const qp = new URLSearchParams({
    ...withRecvWindow(params),
    timestamp: String(timestamp),
  } as Record<string, string>).toString();
  const url = `${BINANCE_BASE}${path}?${qp}&signature=${sign(qp, apiSecret)}`;

  try {
    const { data } = await axios.get<T>(url, {
      headers: { 'X-MBX-APIKEY': apiKey },
      timeout: 15_000,
    });
    return data;
  } catch (err: any) {
    const status = err?.response?.status;
    if (status === 429 || status === 418) {
      const retryAfter = Number(err?.response?.headers?.['retry-after'] || 60);
      logger.warn(
        `⏳ Binance rate limited (${status}). Backing off ${retryAfter}s for ${path}`,
      );
      await sleep(Math.max(1, retryAfter) * 1000);
    }
    // rethrow for the caller to decide how to proceed
    throw err;
  }
}

/* ========= Types (мінімальний зріз) ========= */

type PositionRisk = {
  symbol: string;
  positionAmt: string; // "0", "10.5", "-3"
  entryPrice: string;
  markPrice: string;
  unRealizedProfit: string;
  positionSide?: 'BOTH' | 'LONG' | 'SHORT';
};

type UserTrade = {
  symbol: string;
  id: number; // tradeId
  orderId: number;
  price: string;
  qty: string;
  commission: string;
  commissionAsset: string; // USDT для USDⓈ-M
  realizedPnl: string;
  time: number; // ms
  buyer: boolean; // true = buy, false = sell
  maker: boolean;
};

type TakeProfitCfg = { price: number; sizePct: number; filled?: boolean };

/* ========= Core helpers ========= */

const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);

/** Біржовий підрахунок: Σ realizedPnl − Σ commission (USDT) */
function computeFinalFromTrades(trades: UserTrade[]) {
  const realized = sum(trades.map((t) => Number(t.realizedPnl || 0)));
  const fees = sum(trades.map((t) => Number(t.commission || 0))); // припускаємо USDT-маржин
  const finalPnl = realized - fees;
  const lastTs = trades.length
    ? Math.max(...trades.map((t) => t.time))
    : Date.now();
  return { realized, fees, finalPnl, closedAt: new Date(lastTs) };
}

/**
 * Обрати мапу ТР для перевірки: пріоритет поточним takeProfits, інакше initialTPs
 */
function getTpConfig(pos: IPosition): TakeProfitCfg[] {
  const fromCurrent =
    (pos as any).takeProfits?.map((t: any) => ({
      price: Number(t.price),
      sizePct: Number(t.sizePct),
      filled: Boolean(t.filled),
    })) ?? [];
  const fromInitial =
    (pos as any).initialTPs?.map((t: any) => ({
      price: Number(t.price),
      sizePct: Number(t.sizePct),
      filled: false,
    })) ?? [];
  const tps = fromCurrent.length ? fromCurrent : fromInitial;
  // відфільтруємо сміття
  return tps.filter(
    (t: any) =>
      Number.isFinite(t.price) && Number.isFinite(t.sizePct) && t.sizePct > 0,
  );
}

/**
 * Позначити, які ТР були досягнуті, порівнюючи ціни філів та цільові ТР.
 * NB: це "best-effort" без WS, але працює коректно у 99% випадків.
 */
function markTpFills(
  pos: IPosition,
  trades: UserTrade[],
): { updatedTPs: TakeProfitCfg[]; closedByHint: 'TP' | 'SL' | 'AUTO' } {
  const side = (pos as any).side as 'LONG' | 'SHORT';
  const tps = getTpConfig(pos);
  if (!tps.length || !side) {
    return { updatedTPs: tps, closedByHint: 'AUTO' };
  }

  // початковий розмір для розподілу %, якщо є adds — беремо фактичний сумарний закритий обсяг
  const totalClosedQty =
    side === 'LONG'
      ? sum(trades.filter((t) => t.buyer === false).map((t) => Number(t.qty)))
      : sum(trades.filter((t) => t.buyer === true).map((t) => Number(t.qty)));

  if (totalClosedQty <= 0) {
    return { updatedTPs: tps, closedByHint: 'AUTO' };
  }

  // толеранс до ціни (без exchangeInfo): 0.1% або 2e-6 для дуже дрібних цін
  const tolPct = 0.001;
  const granularTol = (p: number) => Math.max(p * tolPct, 2e-6);

  // Сортуємо ТР у порядку їх досягнення (для коректного розподілу кількості)
  const sortedIdx = tps
    .map((_, i) => i)
    .sort(
      (a, b) =>
        side === 'LONG'
          ? tps[a].price - tps[b].price // LONG: від ближчого до дальшого (нижча → вища)
          : tps[b].price - tps[a].price, // SHORT: від ближчого до дальшого (вища → нижча)
    );

  // Рахуємо, скільки к-сті було закрито "за/краще ніж" кожен ТР
  const eligibleQtyPerTp = new Array(tps.length).fill(0) as number[];
  for (const tr of trades) {
    const price = Number(tr.price);
    const qty = Number(tr.qty);

    // закриваючі трейди: для LONG — sell (buyer=false), для SHORT — buy (buyer=true)
    const isClosing = side === 'LONG' ? tr.buyer === false : tr.buyer === true;
    if (!isClosing) continue;

    for (let i = 0; i < tps.length; i++) {
      const tp = tps[i];
      const ok =
        side === 'LONG'
          ? price >= tp.price - granularTol(tp.price)
          : price <= tp.price + granularTol(tp.price);
      if (ok) {
        eligibleQtyPerTp[i] += qty;
      }
    }
  }

  let alreadyAllocated = 0;
  const updated = tps.map((t) => ({ ...t }));
  for (const idx of sortedIdx) {
    const tp = updated[idx];
    const needQty = (totalClosedQty * tp.sizePct) / 100;
    const available = Math.max(0, eligibleQtyPerTp[idx] - alreadyAllocated);
    const filled = available + 1e-12 >= needQty && needQty > 0; // невеликий epsilon
    if (filled) {
      alreadyAllocated += needQty;
      updated[idx].filled = true;
    } else {
      updated[idx].filled = false;
    }
  }

  const tpClosedQty =
    side === 'LONG'
      ? sum(
          trades
            .filter((t) => t.buyer === false)
            .filter((t) =>
              updated.some(
                (tp) =>
                  tp.filled &&
                  Number(t.price) >= tp.price - granularTol(tp.price),
              ),
            )
            .map((t) => Number(t.qty)),
        )
      : sum(
          trades
            .filter((t) => t.buyer === true)
            .filter((t) =>
              updated.some(
                (tp) =>
                  tp.filled &&
                  Number(t.price) <= tp.price + granularTol(tp.price),
              ),
            )
            .map((t) => Number(t.qty)),
        );

  const closedByHint =
    tpClosedQty >= 0.5 * totalClosedQty
      ? 'TP'
      : (pos as any).stopPrice
        ? 'SL'
        : 'AUTO';

  return { updatedTPs: updated, closedByHint };
}

/* ========= Public API ========= */

export async function reconcileAllSymbols(): Promise<void> {
  const openPositions = await PositionModel.find({ status: 'OPEN' })
    .select(
      '_id symbol openedAt takeProfits initialTPs stopPrice closedBy side entryPrice size meta',
    )
    .lean<(IPosition & { _id: Types.ObjectId })[]>()
    .exec();

  if (!openPositions.length) {
    logger.info('🔄 Reconcile: no OPEN positions found — nothing to do');
    return;
  }

  // 2) Взяти всі позиції з біржі (одним запитом)
  // Note: withRecvWindow is already handled inside binanceGet
  let risks: PositionRisk[] = [];
  try {
    risks = await binanceGet<PositionRisk[]>('/fapi/v2/positionRisk');
  } catch (e) {
    logger.error('❌ Failed to fetch /positionRisk', e);
    return;
  }
  const bySymbol = new Map<string, PositionRisk[]>();
  for (const r of risks) {
    const arr = bySymbol.get(r.symbol) || [];
    arr.push(r);
    bySymbol.set(r.symbol, arr);
  }

  for (const pos of openPositions) {
    const symbol = pos.symbol;
    const risksForSymbol = bySymbol.get(symbol) || [];
    const onExchange = risksForSymbol.some(
      (r) => Math.abs(Number(r.positionAmt)) > 0,
    );

    if (onExchange) {
      logger.info(
        `🟡 ${symbol}: still open on exchange (has non-zero positionAmt) — skip`,
      );
      continue;
    }

    const openedAt = new Date(pos.openedAt).getTime();
    const startTime = Math.max(0, openedAt - 60_000); // невеликий буфер назад
    const endTime = Date.now();

    let trades: UserTrade[] = [];
    try {
      trades = await binanceGet<UserTrade[]>('/fapi/v1/userTrades', {
        symbol,
        startTime,
        endTime,
      });
    } catch (e) {
      logger.error(`❌ ${symbol}: failed to fetch /userTrades`, e);
      continue;
    }

    const { realized, fees, finalPnl, closedAt } =
      computeFinalFromTrades(trades);

    const { updatedTPs, closedByHint } = markTpFills(pos, trades);

    try {
      const prev = await PositionModel.findOneAndUpdate(
        { _id: pos._id, status: 'OPEN' },
        {
          $set: {
            status: 'CLOSED',
            closedAt,
            closedBy: (pos as any).closedBy ?? closedByHint,
            realizedPnl: realized,
            fees,
            finalPnl,
            takeProfits: updatedTPs,
            executions: trades.map((t) => ({
              price: Number(t.price),
              qty: Number(t.qty),
              side: t.buyer ? 'BUY' : 'SELL',
              fee: Number(t.commission),
              ts: t.time,
              orderId: t.orderId,
              tradeId: t.id,
            })),
          },
        },
        { new: false },
      ).exec();

      // Notify in TG only if we actually transitioned OPEN -> CLOSED
      if (prev) {
        try {
          await notifyTrade(
            {
              _id: pos._id,
              symbol,
              side: (pos as any).side,
              closedBy: (pos as any).closedBy ?? closedByHint,
              finalPnl,
              realizedPnl: realized,
              fees,
              closedAt,
              entryPrice: (pos as any).entryPrice,
              size: (pos as any).size,
              stopPrice: (pos as any).stopPrice ?? null,
              takeProfits: updatedTPs as any,
              initialTPs: (pos as any).initialTPs as any,
              meta: (pos as any).meta,
            },
            'CLOSED',
          );
        } catch (notifyErr) {
          logger.warn(`⚠️ ${symbol}: telegram notify failed`, notifyErr);
        }
      }
    } catch (e) {
      logger.error(`❌ ${symbol}: failed to update position in DB`, e);
      continue;
    }

    try {
      await cancelAllOrders(symbol);
    } catch (e) {
      // Якщо ордерів нема — Binance може повернути помилку; це ок
      logger.warn(`⚠️ ${symbol}: cancelAllOpenOrders returned`, e);
    }
  }
}

/** Зручний раннер: перший запуск одразу, далі — кожні N мс (дефолт 2 хв) */
export function startReconciler(intervalMs = 2 * 60 * 1000) {
  const tick = async () => {
    try {
      await reconcileAllSymbols();
    } catch (e) {
      logger.error('Reconcile tick failed', e);
    }
  };
  tick();
  return setInterval(tick, intervalMs);
}
