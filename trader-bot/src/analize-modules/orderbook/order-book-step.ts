import WebSocket from 'ws';
import { saveDoc } from '../../storage/storage.ts';
import type {
  BinanceDepthPartialUpdate,
  LiquidityCandle,
} from '../../types/index.ts';
import logger from '../../utils/db-logger.ts';

function avg(arr: number[]): number {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function isDepthPayload(x: unknown): x is BinanceDepthPartialUpdate {
  return (
    !!x &&
    typeof x === 'object' &&
    Array.isArray((x as any).b) &&
    Array.isArray((x as any).a)
  );
}

export function OrderBookStepWS(symbol: string = 'BTCUSDT'): () => void {
  const ws = new WebSocket(
    `wss://fstream.binance.com/ws/${symbol.toLowerCase()}@depth10@100ms`,
  );

  let imbalances: number[] = [];
  let spreads: number[] = [];
  let interval: NodeJS.Timeout | undefined;

  ws.on('message', (msg: WebSocket.RawData) => {
    try {
      const data = JSON.parse(msg.toString());
      if (!isDepthPayload(data)) return;

      const bids = data.b;
      const asks = data.a;
      if (!bids.length || !asks.length) return;

      const bidValue = bids.reduce(
        (sum, [p, q]) => sum + parseFloat(p) * parseFloat(q),
        0,
      );
      const askValue = asks.reduce(
        (sum, [p, q]) => sum + parseFloat(p) * parseFloat(q),
        0,
      );

      const denom = bidValue + askValue;
      if (!Number.isFinite(denom) || denom <= 0) return;

      const topBid = Number(bids[0][0]);
      const topAsk = Number(asks[0][0]);
      if (!Number.isFinite(topBid) || !Number.isFinite(topAsk)) return;

      const imbalance = bidValue / denom;
      const spread = topAsk - topBid;

      if (Number.isFinite(imbalance) && Number.isFinite(spread)) {
        imbalances.push(imbalance);
        spreads.push(spread);
      }
    } catch (e: any) {
      logger.warn('⚠️ OrderBook WS parse/warn:', e?.message || e);
    }
  });

  ws.on('error', (err: any) => {
    logger.error('❌ OrderBook WS error:', err.message);
  });

  interval = setInterval(async () => {
    if (imbalances.length === 0) return;

    const avgImbalance = avg(imbalances);
    const avgSpread = avg(spreads);

    const liquidityCandle: LiquidityCandle = {
      symbol,
      time: new Date().toISOString(),
      avgImbalance: Number(avgImbalance.toFixed(5)),
      avgSpread: Number(avgSpread.toFixed(6)),
    };

    try {
      await saveDoc('liquidity', liquidityCandle);
    } catch (e: any) {
      logger.error('❌ saveDoc(liquidity) failed:', e?.message || e);
    }

    imbalances = [];
    spreads = [];
  }, 60_000);

  return () => {
    if (interval) clearInterval(interval);
    try {
      ws.close();
    } catch {}
  };
}
