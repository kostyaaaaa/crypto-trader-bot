// src/trading/core/monitor.ts
import type { IPosition } from 'crypto-trader-db';
import { loadDocs } from '../../storage/storage';
import type { BinanceSide, LiveStateFlat, Side } from '../../types/binance-res'; // use canonical Binance types
import logger from '../../utils/db-logger';
import {
  cancelStopOrders,
  openMarketOrder,
  placeStopLoss,
} from '../binance/binance-functions/index';
import { getActivePositions } from './binance-positions-manager';
import {
  addToPosition,
  adjustPosition,
  getOpenPosition,
  updateStopPrice,
} from './history-store';
import markPriceHub from './mark-price-hub';

/* ========= local types (мінімально потрібні) ========= */

interface AnalysisRecord {
  bias?: Side | 'NEUTRAL';
  signal?: Side | 'NEUTRAL';
  time?: string | Date;
  createdAt?: string | Date;
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/* ========= helpers ========= */

async function getMarkFromHub(symbol: string): Promise<number | null> {
  const m = markPriceHub.getMark(symbol);
  if (m && !m.stale) return Number(m.markPrice);
  const first = await markPriceHub.waitForMark(symbol);
  return first?.markPrice ?? null;
}

// Пріоритет: bias → signal
function getAnaSide(
  a: AnalysisRecord | null | undefined,
): Side | 'NEUTRAL' | null {
  return (a?.bias ?? a?.signal) || null;
}

function roundQty(q: number): number {
  const n = Number(q) || 0;
  return Number(n.toFixed(3)); // 3 знаки — щоб гарантовано пройти фільтри
}

const TRADE_MODE = process.env.TRADE_MODE || 'paper';

/* ========= main ========= */

export async function monitorPositions(params: {
  symbol: string;
  strategy: {
    exits?: {
      oppositeCountExit?: number;
      trailing?: {
        use?: boolean;
        startAfterPct?: number;
        trailStepPct?: number;
      };
    };
    sizing?: {
      maxAdds?: number;
      addOnAdverseMovePct?: number;
      addMultiplier?: number;
    };
    capital?: { leverage?: number };
  };
}): Promise<void> {
  const { symbol, strategy } = params;

  let openDoc = (await getOpenPosition(symbol)) as IPosition | null;
  if (!openDoc) return;

  let positions: LiveStateFlat[] = [];

  try {
    positions = await getActivePositions(symbol);
  } catch {
    return;
  }
  if (!positions?.length) return;

  const price = await getMarkFromHub(symbol);
  if (price == null || !Number.isFinite(price)) {
    logger.warn(
      `⚠️ ${symbol}: no mark price from hub — skip monitor iteration`,
    );
    return;
  }

  // Скільки останніх аналізів дивимося на протилежність (0 → вимкнено)
  const rawOpp = strategy?.exits?.oppositeCountExit;
  const oppExitN = Number.isFinite(Number(rawOpp))
    ? Math.max(0, Math.floor(Number(rawOpp)))
    : 0;

  // Останні аналізи для швидких перевірок
  let recentAnalyses: AnalysisRecord[] = [];
  try {
    const docCount = oppExitN > 0 ? oppExitN : 1;
    const analysisDocs = (await loadDocs(
      'analysis',
      symbol,
      docCount,
    )) as AnalysisRecord[];
    if (Array.isArray(analysisDocs) && analysisDocs.length) {
      recentAnalyses = [...analysisDocs].sort((a, b) => {
        const at = new Date(a?.time || a?.createdAt || 0).getTime();
        const bt = new Date(b?.time || b?.createdAt || 0).getTime();
        return bt - at; // newest first
      });
    }
  } catch {
    /* ignore */
  }

  for (const pos of positions) {
    let { side, entryPrice, size: liveQtyRaw, orders } = pos;
    const liveQty = Math.abs(Number(liveQtyRaw));

    if (!Number.isFinite(liveQty) || liveQty <= 0) {
      logger.warn(`⚠️ ${symbol}: missing size in live position — skip manage`);
      continue;
    }

    logger.info(
      `🔎 ${symbol} MON: liveQty=${liveQty}, adds=${openDoc?.adds?.length || 0}`,
    );

    const dir = side === 'LONG' ? 1 : -1;
    const binanceSide: BinanceSide = side === 'LONG' ? 'BUY' : 'SELL';

    /* ===== 0) Поточний SL (з БД або з live orders) ===== */
    let currentSL: number | null = Number.isFinite(Number(openDoc?.stopPrice))
      ? Number(openDoc?.stopPrice)
      : null;

    if (currentSL == null && Array.isArray(orders)) {
      const slOrder = orders.find((o) => o.type === 'SL');
      if (slOrder) currentSL = Number(slOrder.price) || null;
    }

    /* ===== 1) Вихід по N протилежних сигналів підряд ===== */
    if (oppExitN > 0) {
      const isOpposite = (s: Side | 'NEUTRAL' | null) =>
        side === 'LONG' ? s === 'SHORT' : s === 'LONG';

      const lastN = recentAnalyses.slice(0, oppExitN);
      const allOpposite =
        lastN.length === oppExitN &&
        lastN.every((a) => isOpposite(getAnaSide(a)));

      if (allOpposite) {
        logger.info(
          `⏹️ ${symbol}: exit by opposite signals x${oppExitN} (pos=${side})`,
        );

        if (TRADE_MODE === 'live') {
          try {
            await cancelStopOrders(symbol);
          } catch {}
          const closeSide: BinanceSide = side === 'LONG' ? 'SELL' : 'BUY';
          try {
            await openMarketOrder(symbol, closeSide, roundQty(liveQty));
          } catch {}
        }

        // В БД — це фінальний CLOSE (підтягне PnL по розміру/ціні виконання)
        try {
          await adjustPosition(symbol, {
            type: 'CLOSE',
            price,
            size: liveQty,
            reason: `EXIT_OPPOSITE x${oppExitN}`,
          });
        } catch {}

        continue; // переходимо до наступної позиції
      }
    }

    /* ===== 2) DCA / Adds ===== */
    let addsCount = openDoc?.adds?.length || 0;
    if (!addsCount && Array.isArray(openDoc?.adjustments)) {
      addsCount = openDoc!.adjustments!.filter((a) => a?.type === 'ADD').length;
    }

    const sizing = strategy?.sizing;
    if (sizing && Number(sizing.maxAdds) > 0 && entryPrice) {
      const roiTrigger = Math.max(0, Number(sizing.addOnAdverseMovePct) || 0);

      const levCfg = Math.max(1, Number(strategy?.capital?.leverage) || 1);
      const levLive = Math.max(
        1,
        Number(pos?.leverage) || Number(openDoc?.meta?.leverage) || levCfg,
      );
      const lev = levLive;

      const priceMovePct = ((price - entryPrice) / entryPrice) * 100 * dir;
      const unreal = Number(pos?.unRealizedProfit);
      const initMargin = Number(
        pos?.isolatedMargin ?? pos?.initialMargin ?? NaN,
      );

      const pnlRoiPct =
        Number.isFinite(unreal) && Number.isFinite(initMargin) && initMargin > 0
          ? (unreal / initMargin) * 100
          : priceMovePct * lev;

      const shouldAdd = pnlRoiPct <= -roiTrigger;
      const canAdd = addsCount < Number(sizing.maxAdds);

      logger.info(
        `📉 ADD check ${symbol}: ROI=${pnlRoiPct.toFixed(2)}% <= -${roiTrigger}%? ${shouldAdd} | adds=${addsCount}/${sizing.maxAdds}`,
      );

      if (shouldAdd && canAdd) {
        // Обчислюємо на базі першого нотіоналу (initialSizeUsd) або поточного size з БД
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

        if (Number.isFinite(addQty) && addQty > 0) {
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
            logger.info(
              `✅ ADD persisted ${symbol}: qty=${Number(addQty)} @ ${price}`,
            );
          } catch (e: unknown) {
            logger.error(`❌ ADD persist failed ${symbol}: ${errMsg(e)}`);
          }

          // оновимо openDoc, щоб не подвоїти ADD за ту ж ітерацію
          try {
            const refreshed = (await getOpenPosition(
              symbol,
            )) as IPosition | null;
            if (refreshed) openDoc = refreshed;
          } catch {}
        } else {
          logger.info(
            `⛔ ADD qty too small/invalid for ${symbol}: calc=${addQty}`,
          );
        }
      }
    }

    /* ===== 3) TRAILING по ROI% ===== */
    const trailingCfg = strategy?.exits?.trailing;
    if (trailingCfg?.use && entryPrice) {
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

        // оцінка кількості (якщо треба для маржі)
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
          pnlRoiPct = (unreal / initMarginPos) * 100; // як у UI Binance
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

        // Активація трейла
        if (!trailingState?.active && pnlRoiPct >= startAfterRoiPct) {
          trailingState = {
            active: true,
            startAfterPct: startAfterRoiPct,
            trailStepPct: gapRoiPct,
            anchor: pnlRoiPct,
          };

          // просто зафіксуємо в історії; фактичну стоп-ціну ще не рухаємо
          // (updateStopPrice міняє stopPrice у БД — не чіпаємо, якщо SL ще не було)
          if (currentSL != null) {
            try {
              await updateStopPrice(symbol, currentSL, 'TRAIL_ON');
            } catch {}
          }
        }

        // Якщо трейл активний — тягнемо SL
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
            currentSL = newStop;
          } else {
            logger.info(
              `⛔ TRAIL no move ${symbol}: newStop=${newStop.toFixed(6)} vs currentSL=${currentSL ?? '—'}`,
            );
          }
        }
      } catch (e: unknown) {
        logger.error(`❌ TRAIL error ${symbol}: ${errMsg(e)}`);
      }
    } else {
      if (!trailingCfg?.use)
        logger.info(`🚫 TRAIL disabled in config for ${symbol}`);
      if (!entryPrice)
        logger.warn(`🚫 TRAIL skip: missing entryPrice for ${symbol}`);
    }
  }
}
