// order-book-step.js
// --- Збирає дані з ордербуку (глибина ринку) через Binance WS ---
// Джерело: wss://fstream.binance.com/ws/{symbol}@depth10@100ms
//   depth10 → топ-10 рівнів ордербуку (bids/asks)
//   100ms   → оновлення кожні 100 мс
//
// Мета: агрегувати ліквідність → середній дисбаланс (imbalance) та спред

import WebSocket from 'ws';
import { saveDoc } from '../../storage/storage.js';
import logger from '../../utils/db-logger.js';

export function OrderBookStepWS(symbol = 'BTCUSDT') {
  const ws = new WebSocket(
    `wss://fstream.binance.com/ws/${symbol.toLowerCase()}@depth10@100ms`,
  );
  let imbalances = [];
  let spreads = [];
  let interval;
  ws.on('open', () => logger.success(symbol, 'OrderBook'));

  ws.on('message', (msg) => {
    const data = JSON.parse(msg.toString());
    if (!data.b || !data.a) return;
    // console.log(data);

    const bids = data.b;
    const asks = data.a;

    const bidValue = bids.reduce(
      (sum, [price, qty]) => sum + parseFloat(price) * parseFloat(qty),
      0,
    );
    const askValue = asks.reduce(
      (sum, [price, qty]) => sum + parseFloat(price) * parseFloat(qty),
      0,
    );

    const imbalance = bidValue / (bidValue + askValue);
    const spread = parseFloat(asks[0][0]) - parseFloat(bids[0][0]);

    imbalances.push(imbalance);
    spreads.push(spread);
  });

  ws.on('error', (err) => {
    console.error('❌ WS error:', err.message);
  });

  interval = setInterval(async () => {
    if (imbalances.length === 0) return;

    const avgImbalance =
      imbalances.reduce((a, b) => a + b, 0) / imbalances.length;
    const avgSpread = spreads.reduce((a, b) => a + b, 0) / spreads.length;

    const liquidityCandle = {
      symbol,
      time: new Date().toISOString(),
      avgImbalance: Number(avgImbalance.toFixed(5)),
      avgSpread: Number(avgSpread.toFixed(6)),
    };

    await saveDoc('liquidity', liquidityCandle);

    imbalances = [];
    spreads = [];
  }, 60_000);

  return () => {
    clearInterval(interval);
    ws.close();
  };
}
