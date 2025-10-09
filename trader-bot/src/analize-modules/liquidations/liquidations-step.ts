import { type ILiquidations, type ISide } from 'crypto-trader-db';
import WebSocket from 'ws';
import { saveDoc } from '../../storage/storage.ts';
import type { ForceOrderEvent } from '../../types/index.ts';
import logger from '../../utils/db-logger.ts';

export interface LiquidationItem {
  symbol: string;
  side: ISide;
  price: number;
  qty: number;
  value: number;
  time: string;
}

export function LiquidationsStepWS(
  symbol: string = 'ETHUSDT',
  minValue: number = 50_000,
  windowMs: number = 60_000,
): () => void {
  const ws = new WebSocket('wss://fstream.binance.com/ws/!forceOrder@arr');

  let bucket: LiquidationItem[] = [];
  let interval: ReturnType<typeof setInterval>;

  ws.on('message', (msg: WebSocket.RawData) => {
    try {
      const raw = JSON.parse(msg.toString());
      const events = extractForceOrders(raw);

      for (const ev of events) {
        if (!ev || ev.e !== 'forceOrder' || !ev.o) continue;
        const o = ev.o;

        // фільтруємо по символу
        if (o.s !== symbol) continue;

        const price = num(o.ap ?? o.p);
        const qty = num(o.q);
        const value = price * qty;

        if (!Number.isFinite(value) || value < minValue) continue;

        const item: LiquidationItem = {
          symbol: o.s,
          side: o.S as ISide,
          price,
          qty,
          value,
          time: new Date(o.T ?? ev.E ?? Date.now()).toISOString(),
        };

        bucket.push(item);
      }
    } catch (e: any) {
      logger.error('❌ Liquidations WS parse error:', e?.message || e);
    }
  });

  interval = setInterval(async () => {
    if (bucket.length === 0) return;

    const totalValue = bucket.reduce((s, x) => s + x.value, 0);
    const buys = bucket.filter((x) => x.side === 'BUY');
    const sells = bucket.filter((x) => x.side === 'SELL');

    const buysValue = buys.reduce((s, x) => s + x.value, 0);
    const sellsValue = sells.reduce((s, x) => s + x.value, 0);

    const candle: ILiquidations = {
      symbol,
      time: new Date(),
      count: bucket.length,
      buysCount: buys.length,
      sellsCount: sells.length,
      buysValue: round2(buysValue),
      sellsValue: round2(sellsValue),
      totalValue: round2(totalValue),
      minValue,
    };

    try {
      await saveDoc('liquidations', candle);
    } catch (e: any) {
      logger.error('❌ Liquidations save error:', e?.message || e);
    } finally {
      bucket = [];
    }
  }, windowMs);

  ws.on('error', (err: any) => {
    logger.error('❌ Liquidations WS error:', err?.message || err);
  });

  return () => {
    clearInterval(interval);
    try {
      ws.close();
    } catch {}
  };
}

/* ---------- helpers ---------- */
function extractForceOrders(raw: unknown): ForceOrderEvent[] {
  const maybe = raw as any;
  if (Array.isArray(maybe)) return maybe as ForceOrderEvent[];
  if (maybe?.data) {
    return Array.isArray(maybe.data)
      ? (maybe.data as ForceOrderEvent[])
      : [maybe.data as ForceOrderEvent];
  }
  return [maybe as ForceOrderEvent];
}

function num(x: unknown): number {
  const n = Number(x);
  return Number.isFinite(n) ? n : NaN;
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}
