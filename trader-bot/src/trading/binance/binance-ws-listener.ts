// trading/binance/binance-ws-listener.ts
import axios from 'axios';
import type { IPosition } from 'crypto-trader-db';
import WebSocket from 'ws';
import type { OrderTradeUpdateEvent, UserDataEvent } from '../../types/index';
import logger from '../../utils/db-logger';
import { getOpenPosition } from '../core/history-store';
import { cancelAllOrders } from './binance-functions/index';
import { handleMarketOrder } from './handlers/market-order-handler';
import { handleStopLoss } from './handlers/stop-loss-handler';
import { handleTakeProfit } from './handlers/take-profit-handler';
import { addFillToAgg, isDuplicateOrderEvent } from './helpers/fill-aggregator';
import { forceCloseIfLeftover } from './helpers/force-close';

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
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
        addFillToAgg(o.i, lastQty, lastPx);
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

      // Route to appropriate handler based on order type
      if (type === 'STOP_MARKET') {
        await handleStopLoss(m, pos);
      } else if (type === 'TAKE_PROFIT_MARKET') {
        await handleTakeProfit(m, pos);
      } else if (type === 'MARKET') {
        await handleMarketOrder(m);
      }
      break;
    }

    default:
    // 🔹 Якщо прийшов інший івент, ми його ігноруємо.
  }
}
