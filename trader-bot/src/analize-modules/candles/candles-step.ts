import { type ICandle } from 'crypto-trader-db';
import WebSocket from 'ws';
import { submitCandle } from '../../api';
import logger from '../../utils/db-logger';

export interface CandleItem {
  symbol: string;
  timeframe: string;
  time: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export function CandlesStepWS(
  symbol: string = 'ETHUSDT',
  timeframe: string | string[] = '1m',
): () => void {
  // Підтримуємо як один таймфрейм, так і масив
  const timeframes = Array.isArray(timeframe) ? timeframe : [timeframe];

  // Створюємо URL для множинних таймфреймів
  const streams = timeframes
    .map((tf) => `${symbol.toLowerCase()}@kline_${tf}`)
    .join('/');
  const ws = new WebSocket(`wss://fstream.binance.com/ws/${streams}`);

  // Throttling для незакритих свічок - оновлюємо раз на 10 секунд
  const lastUpdateTime: Record<string, number> = {};
  const UPDATE_INTERVAL_MS = 10_000; // 10 секунд

  ws.on('message', (msg: WebSocket.RawData) => {
    try {
      const raw = JSON.parse(msg.toString());

      // Перевіряємо чи це kline дані
      if (raw.e !== 'kline' || !raw.k) return;

      const kline = raw.k;

      // Фільтруємо по символу
      if (kline.s !== symbol) return;

      // Зберігаємо закриті свічки для всіх символів
      // Для ETHUSDT і BTCUSDT також зберігаємо незакриті свічки (з throttling)
      const isClosedCandle = kline.x; // x: true означає що свічка закрита
      const isTargetSymbol = symbol === 'ETHUSDT' || symbol === 'BTCUSDT';

      // Для незакритих свічок перевіряємо throttling
      if (!isClosedCandle) {
        if (!isTargetSymbol) return; // Не зберігаємо незакриті свічки для інших символів

        // Перевіряємо чи можна оновити (раз на 10 секунд)
        const candleKey = `${kline.s}_${kline.i}`;
        const now = Date.now();
        const lastUpdate = lastUpdateTime[candleKey] || 0;

        if (now - lastUpdate < UPDATE_INTERVAL_MS) {
          return; // Пропускаємо оновлення, ще не пройшло 10 секунд
        }

        lastUpdateTime[candleKey] = now;
      }

      const open = parseFloat(kline.o || '0');
      const high = parseFloat(kline.h || '0');
      const low = parseFloat(kline.l || '0');
      const close = parseFloat(kline.c || '0');
      const volume = parseFloat(kline.v || '0');

      if (
        !Number.isFinite(open) ||
        !Number.isFinite(high) ||
        !Number.isFinite(low) ||
        !Number.isFinite(close) ||
        !Number.isFinite(volume)
      )
        return;

      const candle: ICandle = {
        symbol: kline.s,
        timeframe: kline.i, // i - інтервал свічки (1m, 5m, 15m, тощо)
        time: new Date(kline.t || Date.now()), // t - час відкриття свічки
        open,
        high,
        low,
        close,
        volume,
      };

      // Зберігаємо свічку в DB
      const candleType = isClosedCandle ? 'closed' : 'non-closed (throttled)';
      submitCandle(candle).catch((e: any) => {
        logger.error(
          `❌ Failed to submit ${candleType} candle:`,
          e?.message || e,
        );
      });
    } catch (e: any) {
      logger.error('❌ Candles WS parse error:', e?.message || e);
    }
  });

  ws.on('error', (err: any) => {
    logger.error('❌ Candles WS error:', err?.message || err);
  });

  ws.on('close', () => {
    logger.warn(
      `⚠️ Candles WS connection closed for ${symbol}@${timeframes.join(',')}`,
    );
  });

  return () => {
    try {
      ws.close();
    } catch {}
  };
}
