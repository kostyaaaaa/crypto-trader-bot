// trading/monitor.js
import {
  getActivePositions,
  updatePosition,
  closePosition,
  partialClose,
  flipPosition,
} from './positions.js';
import { getLastPrice } from '../utils/getLastPrice.js';
import { loadDocs } from '../storage/storage.js';
import { applyAddToPosition } from './positions.js';

export async function monitorPositions({ symbol, strategy }) {
  const positions = await getActivePositions(symbol);
  if (!positions.length) return;

  const price = await getLastPrice(symbol);
  if (price == null) return;

  for (const pos of positions) {
    const { side, entryPrice } = pos;
    const dir = side === 'LONG' ? 1 : -1;

    /* ===== 1) TAKE PROFIT ===== */
    if (pos.takeProfits?.length) {
      for (const tp of [...pos.takeProfits]) {
        const hit =
            (side === 'LONG' && price >= tp.price) ||
            (side === 'SHORT' && price <= tp.price);
        if (hit) {
          await partialClose(pos.id, tp.sizePct, 'TAKE PROFIT', price);
        }
      }
    }

    /* ===== 2) TRAILING ===== */
    const trailingCfg = strategy?.exits?.trailing;
    const trailing = pos.trailing || {
      active: pos.trailActive || false,
      anchor: pos.trailAnchor || null,
      startAfterPct: trailingCfg?.startAfterPct,
      trailStepPct: trailingCfg?.trailStepPct,
    };

    if (trailingCfg?.use && entryPrice) {
      const movePct = ((price - entryPrice) / entryPrice) * 100 * dir;

      if (!trailing.active && movePct >= trailing.startAfterPct) {
        const newStop =
            side === 'LONG'
                ? price * (1 - trailing.trailStepPct / 100)
                : price * (1 + trailing.trailStepPct / 100);

        await updatePosition(pos.id, {
          trailing: { ...trailing, active: true, anchor: price },
          stopPrice: newStop,
        });
      } else if (trailing.active && trailing.anchor) {
        const isNewAnchor =
            (side === 'LONG' && price > trailing.anchor) ||
            (side === 'SHORT' && price < trailing.anchor);

        if (isNewAnchor) {
          const newStop =
              side === 'LONG'
                  ? price * (1 - trailing.trailStepPct / 100)
                  : price * (1 + trailing.trailStepPct / 100);

          await updatePosition(pos.id, {
            trailing: { ...trailing, anchor: price },
            stopPrice: newStop,
          });
        }
      }
    }

    /* ===== 3) HARD SL ===== */
    if (pos.stopPrice != null) {
      const hitSL =
          (side === 'LONG' && price <= pos.stopPrice) ||
          (side === 'SHORT' && price >= pos.stopPrice);

      if (hitSL) {
        await closePosition(pos.id, 'STOP LOSS', price);
        continue;
      }
    }

    /* ===== 4) SIGNAL-EXIT / FLIP ===== */
    const [lastAnalysis] = await loadDocs('analysis', symbol, 1);
    const flipRules = strategy?.exits?.sl?.signalRules?.flipIf;

    if (lastAnalysis && flipRules) {
      const { bias, scores } = lastAnalysis;
      const oppSide = side === 'LONG' ? 'SHORT' : 'LONG';

      if (
          bias === oppSide &&
          (scores?.[bias] ?? 0) >= flipRules.minOppScore &&
          (scores?.[bias] ?? 0) - (scores?.[side] ?? 0) >= flipRules.scoreGap
      ) {
        await flipPosition(pos.id, bias, price);
        continue;
      }
    }

    /* ===== 5) DCA / Adds ===== */
    const { sizing } = strategy;
    if ((pos.adds || 0) < sizing.maxAdds) {
      const movePct = sizing.addOnAdverseMovePct / 100;
      const baseEntry = pos.avgEntry ?? pos.entryPrice;

      const adversePrice =
          side === 'LONG'
              ? baseEntry * (1 - movePct)
              : baseEntry * (1 + movePct);

      const condition =
          (side === 'LONG' && price <= adversePrice) ||
          (side === 'SHORT' && price >= adversePrice);

      if (condition) {
        await applyAddToPosition(pos, price, sizing, strategy.exits);
      }
    }
  }
}