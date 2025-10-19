import type { IPosition } from 'crypto-trader-db';
import type { LiveStateFlat } from '../../../types';
import logger from '../../../utils/db-logger';
import {
  cancelStopOrders,
  placeStopLoss,
} from '../../binance/binance-functions/index';
import { roundQty, TRADE_MODE } from '../helpers/monitor-helpers';
import { adjustPosition, updateStopPrice } from '../history-store';

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * Execute trailing stop strategy
 */
export async function executeTrailingStop(params: {
  symbol: string;
  pos: LiveStateFlat;
  openDoc: IPosition;
  price: number;
  strategy: {
    exits?: {
      trailing?: {
        use?: boolean;
        startAfterPct?: number;
        trailStepPct?: number;
      };
    };
    capital?: { leverage?: number };
  };
  currentSL: number | null;
}): Promise<void> {
  const { symbol, pos, openDoc, price, strategy, currentSL } = params;

  const trailingCfg = strategy?.exits?.trailing;
  if (!trailingCfg?.use) {
    return;
  }

  const { side, entryPrice, size: liveQtyRaw } = pos;
  const liveQty = Math.abs(Number(liveQtyRaw));

  if (!entryPrice) {
    logger.warn(`🚫 TRAIL skip: missing entryPrice for ${symbol}`);
    return;
  }

  const dir = side === 'LONG' ? 1 : -1;

  try {
    let trailingState = openDoc?.trailing || null;

    const levCfg = Math.max(1, Number(strategy?.capital?.leverage) || 1);
    const levLive = Math.max(
      1,
      Number(pos?.leverage) || Number(openDoc?.meta?.leverage) || levCfg,
    );
    const lev = levLive;

    const startAfterRoiPct = Math.max(
      0,
      Number(trailingCfg.startAfterPct) || 0,
    );
    const gapRoiPct = Math.max(0, Number(trailingCfg.trailStepPct) || 0);

    const priceMovePct = ((price - entryPrice) / entryPrice) * 100 * dir;

    const unreal = Number(pos?.unRealizedProfit);
    const initMarginPos = Number(
      pos?.isolatedMargin ?? pos?.initialMargin ?? NaN,
    );

    // Estimate quantity for margin calculation
    const qtyFromPos = Number(pos?.size);
    const qtyFromInitialNotional =
      Number.isFinite(Number(openDoc?.size)) && entryPrice
        ? Number(openDoc!.size) / entryPrice
        : NaN;

    const estQty =
      [qtyFromPos, qtyFromInitialNotional, Number(liveQty)].find(
        (v) => Number.isFinite(v) && v! > 0,
      ) || 0;

    let marginUsd = Number(pos?.isolatedMargin ?? pos?.initialMargin);
    if (!Number.isFinite(marginUsd) || marginUsd <= 0) {
      const levForMargin = lev;
      if (Number.isFinite(estQty) && estQty > 0 && levForMargin > 0) {
        marginUsd = (estQty * entryPrice) / levForMargin;
      }
    }

    let pnlRoiPct: number;
    if (
      Number.isFinite(unreal) &&
      Number.isFinite(initMarginPos) &&
      initMarginPos > 0
    ) {
      pnlRoiPct = (unreal / initMarginPos) * 100;
    } else if (
      Number.isFinite(marginUsd) &&
      marginUsd > 0 &&
      Number.isFinite(estQty) &&
      estQty > 0
    ) {
      const pnlUsd = (price - entryPrice) * dir * estQty;
      pnlRoiPct = (pnlUsd / marginUsd) * 100;
    } else {
      pnlRoiPct = priceMovePct * lev;
    }

    // Activate trailing
    if (!trailingState?.active && pnlRoiPct >= startAfterRoiPct) {
      trailingState = {
        active: true,
        startAfterPct: startAfterRoiPct,
        trailStepPct: gapRoiPct,
        anchor: pnlRoiPct,
      };

      if (currentSL != null) {
        try {
          await updateStopPrice(symbol, currentSL, 'TRAIL_ON');
        } catch {}
      }
    }

    // If trail active — move SL
    if (trailingState?.active) {
      if (pnlRoiPct > (trailingState.anchor ?? -Infinity)) {
        trailingState.anchor = pnlRoiPct;
      }

      const targetStopRoiPct = Math.max(
        0,
        (trailingState.anchor ?? 0) - (trailingState.trailStepPct ?? 0),
      );

      const useLev = Math.max(1, Number(lev) || 1);
      const targetStopPriceMovePct = targetStopRoiPct / useLev;

      const newStop =
        side === 'LONG'
          ? entryPrice * (1 + targetStopPriceMovePct / 100)
          : entryPrice * (1 - targetStopPriceMovePct / 100);

      const needUpdate =
        (side === 'LONG' && (!currentSL || newStop > currentSL)) ||
        (side === 'SHORT' && (!currentSL || newStop < currentSL));

      if (needUpdate) {
        if (TRADE_MODE === 'live') {
          await cancelStopOrders(symbol, { onlySL: true });
          await placeStopLoss(symbol, side, newStop, roundQty(liveQty));
        }

        await adjustPosition(symbol, {
          type: 'SL_UPDATE',
          price: newStop,
          size: Number(liveQty),
          reason: 'TRAIL',
        });
        await updateStopPrice(symbol, newStop, 'TRAIL');
      }
    }
  } catch (e: unknown) {
    logger.error(`❌ TRAIL error ${symbol}: ${errMsg(e)}`);
  }
}
