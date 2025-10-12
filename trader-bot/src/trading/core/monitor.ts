// src/trading/core/monitor.ts
import type { IPosition } from 'crypto-trader-db';
import { getAnalysis } from '../../api';
import type { LiveStateFlat, Side } from '../../types';
import logger from '../../utils/db-logger';
import { getActivePositions } from './binance-positions-manager';
import { getMarkFromHub } from './helpers/monitor-helpers';
import { getOpenPosition } from './history-store';
import { checkDcaAdd } from './strategies/dca-add';
import { checkOppositeExit } from './strategies/opposite-exit';
import { executeTrailingStop } from './strategies/trailing-stop';

/* ========= local types ========= */

interface AnalysisRecord {
  bias?: Side | 'NEUTRAL';
  signal?: Side | 'NEUTRAL';
  time?: string | Date;
  createdAt?: string | Date;
}

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
    const analysisDocs = (await getAnalysis(
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
    const { side, entryPrice, size: liveQtyRaw, orders } = pos;
    const liveQty = Math.abs(Number(liveQtyRaw));

    if (!Number.isFinite(liveQty) || liveQty <= 0) {
      logger.warn(`⚠️ ${symbol}: missing size in live position — skip manage`);
      continue;
    }

    logger.info(
      `🔎 ${symbol} MON: liveQty=${liveQty}, adds=${openDoc?.adds?.length || 0}`,
    );

    /* ===== 0) Current SL (from DB or live orders) ===== */
    let currentSL: number | null = Number.isFinite(Number(openDoc?.stopPrice))
      ? Number(openDoc?.stopPrice)
      : null;

    if (currentSL == null && Array.isArray(orders)) {
      const slOrder = orders.find((o) => o.type === 'SL');
      if (slOrder) currentSL = Number(slOrder.price) || null;
    }

    /* ===== 1) Exit by N opposite signals ===== */
    const shouldExit = await checkOppositeExit({
      symbol,
      side,
      liveQty,
      price,
      oppExitN,
      recentAnalyses,
    });

    if (shouldExit) continue;

    /* ===== 2) DCA / Adds ===== */
    openDoc = await checkDcaAdd({
      symbol,
      pos,
      openDoc,
      price,
      strategy,
    });

    /* ===== 3) Trailing stop ===== */
    await executeTrailingStop({
      symbol,
      pos,
      openDoc,
      price,
      strategy,
      currentSL,
    });
  }
}
