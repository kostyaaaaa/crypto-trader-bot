import type {
  FuturesPositionRisk,
  LiveOrder,
  LivePosition,
  LiveState,
  OpenOrder,
} from '../../../types';
import logger from '../../../utils/db-logger';
import { getOpenOrdersCached, getPositionRiskCached } from './state';

export async function getLiveState(symbol: string): Promise<LiveState> {
  try {
    // 1) Pull cached position snapshot once
    const positions = ((await getPositionRiskCached()) ||
      []) as FuturesPositionRisk[];
    const pos = positions.find((p) => p.symbol === symbol);

    // If there is no position object at all — no need to load open orders
    if (!pos) {
      return { position: null, orders: [] };
    }

    // Parse size; if zero or NaN — treat as no active position (skip openOrders)
    const rawAmt = parseFloat(pos.positionAmt);
    if (!Number.isFinite(rawAmt) || rawAmt === 0) {
      return { position: null, orders: [] };
    }

    // 2) Build normalized position (we already know size != 0 here)
    const side: LivePosition['side'] = rawAmt > 0 ? 'LONG' : 'SHORT';
    const size = Math.abs(rawAmt);

    const entryParsed = parseFloat(pos.entryPrice);
    const entryPrice: number | null = Number.isFinite(entryParsed)
      ? entryParsed
      : null;

    const lev = Number(pos.leverage);
    const leverage: number | null = Number.isFinite(lev) ? lev : null;

    // Support both unrealizedProfit/unRealizedProfit shapes
    const ur = Number(
      (pos as any).unRealizedProfit ?? (pos as any).unrealizedProfit,
    );
    const unRealizedProfit: number | null = Number.isFinite(ur) ? ur : null;

    const iso = Number(pos.isolatedMargin);
    const isolatedMargin: number | null = Number.isFinite(iso) ? iso : null;

    const initM = Number(pos.initialMargin);
    const initialMargin: number | null = Number.isFinite(initM) ? initM : null;

    const mp = Number((pos as any).markPrice);
    const markPrice: number | null = Number.isFinite(mp) ? mp : null;

    const position: LivePosition = {
      side,
      size,
      entryPrice,
      leverage,
      unRealizedProfit,
      isolatedMargin,
      initialMargin,
      markPrice,
    };

    // 3) Only now, when we know there IS a live position, ask for open orders (cached)
    const openOrders = ((await getOpenOrdersCached(symbol)) ||
      []) as OpenOrder[];

    const orders: LiveOrder[] = openOrders
      .map((o) => {
        const qtyNum = parseFloat(o.origQty);
        const qty = Number.isFinite(qtyNum) ? qtyNum : 0;

        // Prefer stopPrice if valid; fall back to limit price
        const stopPx = parseFloat(o.stopPrice);
        const limitPx = parseFloat(o.price);
        const px =
          Number.isFinite(stopPx) && stopPx > 0
            ? stopPx
            : Number.isFinite(limitPx)
              ? limitPx
              : NaN;

        const type = String(o.type || '').toUpperCase();
        const origType = String(o.origType || '').toUpperCase();
        const isStop = type.includes('STOP') || origType.includes('STOP');
        const isTp =
          type.includes('TAKE_PROFIT') || origType.includes('TAKE_PROFIT');
        if (!isStop && !isTp) return null;

        const sideStr = String(o.side || '').toUpperCase();
        const orderSide: 'BUY' | 'SELL' = sideStr === 'SELL' ? 'SELL' : 'BUY';

        const ord: LiveOrder = {
          type: isStop ? 'SL' : 'TP',
          price: Number.isFinite(px) ? px : null,
          qty,
          side: orderSide,
          reduceOnly: Boolean((o as any).reduceOnly),
        };
        return ord;
      })
      .filter((x): x is LiveOrder => x !== null);

    return { position, orders };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`❌ getLiveState failed for ${symbol}: ${msg}`);
    return { position: null, orders: [] };
  }
}
