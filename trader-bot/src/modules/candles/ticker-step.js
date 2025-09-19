// ticker-step.js
// --- Збирає 1-хвилинні свічки (kline_1m) + дані з bookTicker (bid/ask) ---
// Використовується для збереження історії "candle + середній bid/ask/spread"

import WebSocket from 'ws';
import { saveDoc } from '../../storage/storage.js';
import {logStream} from "../../utils/logger.js";

export function TickerStepWS(symbol = 'ETHUSDT') {
  const lower = symbol.toLowerCase();

  // WS для 1-хв свічок
  const wsKline = new WebSocket(
    `wss://fstream.binance.com/ws/${lower}@kline_1m`,
  );

  // WS для best bid/ask (оновлюється дуже часто)
  const wsBook = new WebSocket(
    `wss://fstream.binance.com/ws/${lower}@bookTicker`,
  );

  // буфери для середнього bid/ask за хвилину
  let bidSum = 0;
  let askSum = 0;
  let count = 0;

  // Кожен update з bookTicker → накопичуємо bid/ask
  wsBook.on('message', (msg) => {
    const data = JSON.parse(msg.toString());
    bidSum += parseFloat(data.b); // best bid
    askSum += parseFloat(data.a); // best ask
    count++;
  });

  // Kline (свічки): приходять кожну хвилину
  wsKline.on('message', async (msg) => {
    const data = JSON.parse(msg.toString());
    const k = data.k;

    if (k && k.x) {
      const candle = {
        symbol: k.s,
        time: new Date(k.t).toISOString(),
        open: parseFloat(k.o),
        high: parseFloat(k.h),
        low: parseFloat(k.l),
        close: parseFloat(k.c),
        volume: parseFloat(k.v),

        avgBid: count > 0 ? bidSum / count : null,
        avgAsk: count > 0 ? askSum / count : null,
        spread: count > 0 ? askSum / count - bidSum / count : null,
      };
      // зберігаємо у storage (файл або Mongo)
      await saveDoc('candles', candle);

      // чистимо буфери
      bidSum = 0;
      askSum = 0;
      count = 0;
    }
  });

  wsKline.on('open', () =>  logStream(symbol, 'kline_1m') );
  wsBook.on('open', () => logStream(symbol, 'bookTicker'));

  wsKline.on('error', (err) =>
    console.error('❌ Kline WS error:', err.message),
  );
  wsBook.on('error', (err) =>
    console.error('❌ BookTicker WS error:', err.message),
  );
}
