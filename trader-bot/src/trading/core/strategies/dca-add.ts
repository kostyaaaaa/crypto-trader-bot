import type { IPosition } from 'crypto-trader-db';
import type { BinanceSide, LiveStateFlat } from '../../../types';
import logger from '../../../utils/db-logger';
import { openMarketOrder } from '../../binance/binance-functions/index';
import { roundQty, TRADE_MODE } from '../helpers/monitor-helpers';
import {
  addToPosition,
  adjustPosition,
  getOpenPosition,
} from '../history-store';

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * Check and execute DCA/add-to-position strategy
 */
export async function checkDcaAdd(params: {
  symbol: string;
  pos: LiveStateFlat;
  openDoc: IPosition;
  price: number;
  strategy: {
    sizing?: {
      maxAdds?: number;
      addOnAdverseMovePct?: number;
      addMultiplier?: number;
    };
    capital?: { leverage?: number };
  };
}): Promise<IPosition> {
  const { symbol, pos, openDoc, price, strategy } = params;

  const { side, entryPrice, size: liveQtyRaw } = pos;
  const liveQty = Math.abs(Number(liveQtyRaw));
  const dir = side === 'LONG' ? 1 : -1;
  const binanceSide: BinanceSide = side === 'LONG' ? 'BUY' : 'SELL';

  let addsCount = openDoc?.adds?.length || 0;
  if (!addsCount && Array.isArray(openDoc?.adjustments)) {
    addsCount = openDoc!.adjustments!.filter((a) => a?.type === 'ADD').length;
  }

  const sizing = strategy?.sizing;
  if (!sizing || !(Number(sizing.maxAdds) > 0) || !entryPrice) {
    return openDoc;
  }

  const roiTrigger = Math.max(0, Number(sizing.addOnAdverseMovePct) || 0);

  const levCfg = Math.max(1, Number(strategy?.capital?.leverage) || 1);
  const levLive = Math.max(
    1,
    Number(pos?.leverage) || Number(openDoc?.meta?.leverage) || levCfg,
  );
  const lev = levLive;

  const priceMovePct = ((price - entryPrice) / entryPrice) * 100 * dir;
  const unreal = Number(pos?.unRealizedProfit);
  const initMargin = Number(pos?.isolatedMargin ?? pos?.initialMargin ?? NaN);

  const pnlRoiPct =
    Number.isFinite(unreal) && Number.isFinite(initMargin) && initMargin > 0
      ? (unreal / initMargin) * 100
      : priceMovePct * lev;

  const shouldAdd = pnlRoiPct <= -roiTrigger;
  const canAdd = addsCount < Number(sizing.maxAdds);

  logger.info(
    `📉 ADD check ${symbol}: ROI=${pnlRoiPct.toFixed(2)}% <= -${roiTrigger}%? ${shouldAdd} | adds=${addsCount}/${sizing.maxAdds}`,
  );

  if (!shouldAdd || !canAdd) {
    return openDoc;
  }

  // Calculate add quantity
  const levForNotional = Math.max(
    1,
    Number(pos?.leverage) ||
      Number(openDoc?.meta?.leverage) ||
      Number(strategy?.capital?.leverage) ||
      1,
  );

  const baseNotionalUsd = Number(openDoc?.size) || 0;
  const baseMarginUsd =
    levForNotional > 0 ? baseNotionalUsd / levForNotional : 0;

  const mult = Number(sizing.addMultiplier) || 1;
  const addMarginUsd = baseMarginUsd * mult;
  const addNotionalUsd = addMarginUsd * levForNotional;
  const addQty = addNotionalUsd / price;

  logger.info(
    `🧮 ADD calc ${symbol}: baseNotional=${baseNotionalUsd.toFixed(2)}$ baseMargin=${baseMarginUsd.toFixed(2)}$ mult=${mult} lev=${levForNotional} -> notional=${addNotionalUsd.toFixed(2)}$ qtyRaw=${addQty}`,
  );

  if (!Number.isFinite(addQty) || addQty <= 0) {
    logger.info(`⛔ ADD qty too small/invalid for ${symbol}: calc=${addQty}`);
    return openDoc;
  }

  if (TRADE_MODE === 'live') {
    try {
      await openMarketOrder(symbol, binanceSide, roundQty(addQty));
    } catch {}
  }

  try {
    await addToPosition(symbol, { qty: Number(addQty), price, fee: 0 });
    await adjustPosition(symbol, {
      type: 'ADD',
      price,
      size: Number(addQty),
    });
    logger.info(`✅ ADD persisted ${symbol}: qty=${Number(addQty)} @ ${price}`);
  } catch (e: unknown) {
    logger.error(`❌ ADD persist failed ${symbol}: ${errMsg(e)}`);
  }

  // Refresh openDoc to avoid double ADD in same iteration
  try {
    const refreshed = (await getOpenPosition(symbol)) as IPosition | null;
    if (refreshed) return refreshed;
  } catch {}

  return openDoc;
}
