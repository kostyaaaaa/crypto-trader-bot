import logger from '../../../utils/db-logger.ts';
import { getOpenOrdersCached, getPositionRiskCached } from './state.ts';
import type { LiveOrder, LiveStateFlat, Side } from './types.ts';

export async function getLiveState(symbol: string): Promise<LiveStateFlat> {
  try {
    const positions = (await getPositionRiskCached()) || [];
    const pos: any = positions.find((p: any) => p.symbol === symbol);

    let side: Side = null;
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

    const openOrders = (await getOpenOrdersCached(symbol)) || [];
    const orders: LiveOrder[] = openOrders
      .map((o: any) => {
        const rawQty = parseFloat(o.origQty);
        const qty = Number.isFinite(rawQty) ? rawQty : 0;

        const sp = parseFloat(o.stopPrice);
        const pxFromStop = Number.isFinite(sp) && sp > 0 ? sp : NaN;
        const px = Number.isFinite(pxFromStop)
          ? pxFromStop
          : Number.isFinite(parseFloat(o.price))
            ? parseFloat(o.price)
            : NaN;

        const isStop =
          typeof o.type === 'string' &&
          (o.type.includes('STOP') || o.origType?.includes?.('STOP'));
        const isTp =
          typeof o.type === 'string' &&
          (o.type.includes('TAKE_PROFIT') ||
            o.origType?.includes?.('TAKE_PROFIT'));

        if (!isStop && !isTp) return null;

        const sideStr = String(o.side || '').toUpperCase();
        const side: string = sideStr === 'SELL' ? 'SELL' : 'BUY';

        return {
          type: isStop ? 'SL' : 'TP',
          price: Number.isFinite(px) ? px : null,
          qty: Number.isFinite(qty) ? qty : 0,
          side,
          reduceOnly: !!o.reduceOnly,
        } as LiveOrder;
      })
      .filter(Boolean) as LiveOrder[];

    return {
      side,
      size,
      entryPrice,
      leverage,
      unRealizedProfit,
      isolatedMargin,
      initialMargin,
      markPrice,
      orders,
    };
  } catch (err: any) {
    logger.error(`❌ getLiveState failed for ${symbol}:`, err?.message || err);

    return {
      side: null,
      size: 0,
      entryPrice: null,
      leverage: null,
      unRealizedProfit: null,
      isolatedMargin: null,
      initialMargin: null,
      markPrice: null,
      orders: [],
    };
  }
}
