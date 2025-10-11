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
    const positions = ((await getPositionRiskCached()) ||
      []) as FuturesPositionRisk[];
    const pos = positions.find((p) => p.symbol === symbol);

    let side: LivePosition['side'] = null;
    let size = 0;
    let entryPrice: number | null = null;
    let leverage: number | null = null;
    let unRealizedProfit: number | null = null;
    let isolatedMargin: number | null = null;
    let initialMargin: number | null = null;
    let markPrice: number | null = null;

    if (pos) {
      const sizeNum = parseFloat(pos.positionAmt);
      side = sizeNum > 0 ? 'LONG' : sizeNum < 0 ? 'SHORT' : null;
      size = Math.abs(sizeNum) || 0;
      entryPrice = sizeNum !== 0 ? parseFloat(pos.entryPrice) : null;

      const lev = Number(pos.leverage);
      leverage = Number.isFinite(lev) ? lev : null;

      const ur = Number(pos.unRealizedProfit ?? pos.unrealizedProfit);
      unRealizedProfit = Number.isFinite(ur) ? ur : null;

      const iso = Number(pos.isolatedMargin);
      isolatedMargin = Number.isFinite(iso) ? iso : null;

      const initM = Number(pos.initialMargin);
      initialMargin = Number.isFinite(initM) ? initM : null;

      const mp = Number(pos.markPrice);
      markPrice = Number.isFinite(mp) ? mp : null;
    }

    const openOrders = ((await getOpenOrdersCached(symbol)) ||
      []) as OpenOrder[];
    const orders: LiveOrder[] = openOrders
      .map((o) => {
        const qtyNum = parseFloat(o.origQty);
        const qty = Number.isFinite(qtyNum) ? qtyNum : 0;

        const stopPx = parseFloat(o.stopPrice);
        const priceFromStop =
          Number.isFinite(stopPx) && stopPx > 0 ? stopPx : NaN;
        const limitPx = parseFloat(o.price);
        const px = Number.isFinite(priceFromStop)
          ? priceFromStop
          : Number.isFinite(limitPx)
            ? limitPx
            : NaN;

        const t = String(o.type || '').toUpperCase();
        const ot = String(o.origType || '').toUpperCase();
        const isStop = t.includes('STOP') || ot.includes('STOP');
        const isTp = t.includes('TAKE_PROFIT') || ot.includes('TAKE_PROFIT');
        if (!isStop && !isTp) return null;

        const sideStr = String(o.side || '').toUpperCase();
        const side = sideStr === 'SELL' ? 'SELL' : 'BUY';

        const ord: LiveOrder = {
          type: isStop ? 'SL' : 'TP',
          price: Number.isFinite(px) ? px : null,
          qty,
          side,
          reduceOnly: Boolean(o.reduceOnly),
        };
        return ord;
      })
      .filter((x): x is LiveOrder => x !== null);

    const position: LivePosition | null = side
      ? {
          side,
          size,
          entryPrice,
          leverage,
          unRealizedProfit,
          isolatedMargin,
          initialMargin,
          markPrice,
        }
      : null;

    return { position, orders };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`❌ getLiveState failed for ${symbol}: ${msg}`);
    return { position: null, orders: [] };
  }
}
