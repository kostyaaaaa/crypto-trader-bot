// trading/binance/ws-listener.js
import axios from 'axios';
import WebSocket from 'ws';
import { notifyTrade } from '../../utils/notify.js';
import logger from 'crypto-trader-server/dist/utils/Logger.js';

// -------------------------
// 1. Отримуємо listenKey
// -------------------------
async function getListenKey() {
  try {
    const res = await axios.post(
      'https://fapi.binance.com/fapi/v1/listenKey',
      {},
      {
        headers: {
          'X-MBX-APIKEY': process.env.BINANCE_API_KEY,
        },
      },
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

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      handleEvent(msg);
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

  // Потрібно оновлювати listenKey раз на ~30 хв
  setInterval(async () => {
    try {
      await axios.put(
        'https://fapi.binance.com/fapi/v1/listenKey',
        {},
        {
          headers: {
            'X-MBX-APIKEY': process.env.BINANCE_API_KEY,
          },
        },
      );
      console.log('♻️ listenKey refreshed');
    } catch (err) {
      console.error('❌ Failed to refresh listenKey:', err.message);
    }
  }, 25 * 60 * 1000);
}

// -------------------------
// 3. Обробка івентів
// -------------------------
function handleEvent(msg) {
  switch (msg.e) {
    case 'ACCOUNT_UPDATE':
      console.log('📊 Account update:', msg.a);
      break;

    case 'ORDER_TRADE_UPDATE':
      const o = msg.o;
      console.log(
        `📦 Order update: ${o.s} ${o.S} status=${o.X}, lastPx=${o.L}, lastQty=${o.l}`,
      );

      if (o.X === 'FILLED') {
        if (o.S === 'SELL') {
          notifyTrade(
            {
              symbol: o.s,
              side: 'SHORT',
              entryPrice: Number(o.L),
              size: Number(o.l) * Number(o.L),
              leverage: 5,
              qty: Number(o.l),
              stopPrice: null,
              takeProfits: [],
              rrrToFirstTp: null,
              exitReason: 'FILLED',
            },
            'CLOSED',
          );
        }
      }
      break;

    default:
      console.log('ℹ️ Unhandled WS event:', msg);
  }
}
