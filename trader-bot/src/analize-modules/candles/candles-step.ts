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

  ws.on('message', (msg: WebSocket.RawData) => {
    try {
      const raw = JSON.parse(msg.toString());

      // Перевіряємо чи це kline дані
      if (raw.e !== 'kline' || !raw.k) return;

      const kline = raw.k;

      // Фільтруємо по символу
      if (kline.s !== symbol) return;

      // Зберігаємо тільки закриті свічки
      if (!kline.x) return; // x: true означає що свічка закрита

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
      submitCandle(candle).catch((e: any) => {
        logger.error('❌ Failed to submit candle:', e?.message || e);
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
