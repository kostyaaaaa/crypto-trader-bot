// trading/binance/ws-listener.js
import axios from 'axios';
import WebSocket from 'ws';
import { notifyTrade } from '../../utils/notify.js';
import {
  closePositionHistory,
  getOpenPosition,
  updateStopPrice,
  updateTakeProfits,
} from '../core/historyStore.js';
import { cancelAllOrders, getPosition, openMarketOrder } from './binance.js';

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
    console.error('❌ Failed to get listenKey:', err.message);
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
    console.log('🔌 Binance user stream connected');
  });

  ws.on('message', async (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      await handleEvent(msg);
    } catch (err) {
      console.error('❌ Failed to parse WS message:', err);
    }
  });

  ws.on('close', () => {
    console.log('⚠️ Binance user stream closed. Reconnecting...');
    setTimeout(() => startUserStream(), 5000);
  });

  ws.on('error', (err) => {
    console.error('❌ WS error:', err.message);
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
        console.log('♻️ listenKey refreshed');
      } catch (err) {
        console.error('❌ Failed to refresh listenKey:', err.message);
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
    const live = await getPosition(symbol);
    if (!live) return;

    const amt = Number(live.positionAmt);
    if (amt === 0) return;

    const side = amt > 0 ? 'SELL' : 'BUY';
    await openMarketOrder(symbol, side, Math.abs(amt));
    console.log(`🔧 Forced close leftover ${amt} on ${symbol}`);
  } catch (err) {
    console.error(`❌ Failed to force close leftover ${symbol}:`, err.message);
  }
}

// -------------------------
// 4. Обробка івентів
// -------------------------
async function handleEvent(msg) {
  switch (msg.e) {
    case 'ACCOUNT_UPDATE':
      break;

    case 'ORDER_TRADE_UPDATE': {
      const o = msg.o;
      const symbol = o.s;
      const status = o.X;
      const side = o.S;
      const type = o.ot;
      const lastPx = Number(o.L);
      const lastQty = Number(o.l);

      console.log(
        `📦 Order update: ${symbol} ${side} status=${status}, type=${type}, lastPx=${lastPx}, lastQty=${lastQty}, orderId=${o.i}`,
      );

      if (status === 'FILLED') {
        const pos = await getOpenPosition(symbol); // 👈 тільки активна позиція
        if (!pos && (type === 'STOP_MARKET' || type === 'TAKE_PROFIT_MARKET')) {
          console.warn(
            `⚠️ ${symbol}: FILLED ${type} but no OPEN position in DB. Forcing close.`,
          );
          const closed = await closePositionHistory(symbol, {
            closedBy: type === 'STOP_MARKET' ? 'SL' : 'TP',
          });
          await cancelAllOrders(symbol);
          await forceCloseIfLeftover(symbol);
          if (closed) notifyTrade(closed, 'CLOSED');
          return;
        }
        // STOP_MARKET logic
        if (type === 'STOP_MARKET') {
          console.log(`🛑 ${symbol}: Stop-loss triggered`);
          if (pos) {
            // Update stop price as filled
            await updateStopPrice(symbol, lastPx, 'FILLED');
            // Close position history
            const closed = await closePositionHistory(symbol, {
              closedBy: 'SL',
            });
            await cancelAllOrders(symbol);
            await forceCloseIfLeftover(symbol);
            if (closed) notifyTrade(closed, 'CLOSED');
          }
        }
        // TAKE_PROFIT_MARKET logic
        else if (type === 'TAKE_PROFIT_MARKET') {
          console.log(`🎯 ${symbol}: Take-profit triggered`);
          if (pos && Array.isArray(pos.takeProfits)) {
            // Clone TPs
            const updatedTps = pos.takeProfits.map((tp) => ({ ...tp }));
            // Find the first unfilled TP near lastPx
            const tolerance = Math.max(0.01, Math.abs(pos.entryPrice * 0.001)); // 0.1% tolerance or min 0.01
            let found = false;
            for (let tp of updatedTps) {
              if (
                !tp.filled &&
                Math.abs(Number(tp.price) - lastPx) <= tolerance
              ) {
                tp.filled = true;
                found = true;
                break;
              }
            }
            // Update TP list in DB
            await updateTakeProfits(
              symbol,
              updatedTps,
              pos.entryPrice,
              'TP_FILLED',
            );
            // If all TPs are now filled, close position
            const allFilled = updatedTps.every((tp) => tp.filled);
            if (allFilled) {
              const closed = await closePositionHistory(symbol, {
                closedBy: 'TP',
              });
              await cancelAllOrders(symbol);
              await forceCloseIfLeftover(symbol);
              if (closed) notifyTrade(closed, 'CLOSED');
            }
            // Else, just update TPs, don't close position
          }
        }
        // MARKET order
        else if (type === 'MARKET') {
          console.log(`✅ Market order filled for ${symbol} (${side})`);
        }
      }
      break;
    }

    default:
  }
}
