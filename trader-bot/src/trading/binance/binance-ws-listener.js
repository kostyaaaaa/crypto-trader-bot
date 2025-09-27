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
      console.log(
        `📦 Order update: ${symbol} ${side} status=${status}, type=${type}, lastPx=${lastPx}, lastQty=${lastQty}, orderId=${o.i}`,
      );

      if (status !== 'FILLED') {
        // 🔹 Нас цікавлять тільки повністю виконані ордери.
        // Якщо ордер ще не FILLED → виходимо.
        break;
      }

      // Перевіряємо чи є у нас відкрита позиція по цьому символу в БД
      const pos = await getOpenPosition(symbol);

      // =======================
      // 🛑 Випадок: закриваючий ордер (SL/TP), але в БД немає відкритої позиції
      // =======================
      if (!pos && (type === 'STOP_MARKET' || type === 'TAKE_PROFIT_MARKET')) {
        console.warn(
          `⚠️ ${symbol}: FILLED ${type} but no OPEN position in DB. Forcing close.`,
        );
        const closed = await closePositionHistory(symbol, {
          closedBy: type === 'STOP_MARKET' ? 'SL' : 'TP', // маркуємо чим закрилось
        });
        await cancelAllOrders(symbol); // прибираємо всі інші ордери
        await forceCloseIfLeftover(symbol); // підстраховка: якщо щось залишилось на біржі
        if (closed) notifyTrade(closed, 'CLOSED'); // пушимо в нотифікації
        return;
      }

      // =======================
      // 🛑 Stop-loss (STOP_MARKET)
      // =======================
      if (type === 'STOP_MARKET') {
        console.log(`🛑 ${symbol}: Stop-loss triggered`);
        if (pos) {
          // Оновлюємо ціну SL як "виконану"
          await updateStopPrice(symbol, lastPx, 'FILLED');

          // Закриваємо позицію в історії
          const closed = await closePositionHistory(symbol, {
            closedBy: 'SL',
          });

          // Чистимо залишки
          await cancelAllOrders(symbol);
          await forceCloseIfLeftover(symbol);

          // Відправляємо нотифікацію
          if (closed) notifyTrade(closed, 'CLOSED');
        }
      }

      // =======================
      // 🎯 Take-profit (TAKE_PROFIT_MARKET)
      // =======================
      else if (type === 'TAKE_PROFIT_MARKET') {
        console.log(`🎯 ${symbol}: Take-profit triggered`);
        if (pos && Array.isArray(pos.takeProfits)) {
          // Беремо копію поточних тейків
          const updatedTps = pos.takeProfits.map((tp) => ({ ...tp }));

          // Шукаємо тейк, який відповідає ціні (з невеликою похибкою)
          const tolerance = Math.max(0.01, Math.abs(pos.entryPrice * 0.001)); // 0.1% або мін. 0.01
          let found = false;
          for (let tp of updatedTps) {
            if (
              !tp.filled &&
              Math.abs(Number(tp.price) - lastPx) <= tolerance
            ) {
              tp.filled = true; // позначаємо цей TP як виконаний
              found = true;
              break;
            }
          }

          // Оновлюємо список тейків у БД
          await updateTakeProfits(
            symbol,
            updatedTps,
            pos.entryPrice,
            'TP_FILLED',
          );

          // Якщо ВСІ тейки виконані → закриваємо позицію
          const allFilled = updatedTps.every((tp) => tp.filled);
          if (allFilled) {
            const closed = await closePositionHistory(symbol, {
              closedBy: 'TP',
            });
            await cancelAllOrders(symbol);
            await forceCloseIfLeftover(symbol);
            if (closed) notifyTrade(closed, 'CLOSED');
          }
          // Інакше залишаємо позицію відкритою (частковий TP)
        }
      }

      // =======================
      // ✅ MARKET (звичайний маркет ордер, відкриття/закриття)
      // =======================
      else if (type === 'MARKET') {
        console.log(`✅ Market order filled for ${symbol} (${side})`);
        // Тут можна обробити логіку відкриття нової позиції або закриття вручну
      }
    }

    default:
    // 🔹 Якщо прийшов інший івент, ми його ігноруємо.
  }
}
