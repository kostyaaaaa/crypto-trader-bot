// trading/core/monitor.js
import axios from "axios";
import {
  openMarketOrder,
  cancelStopOrders,   // 👈 тільки стопи, TP залишаємо
  placeStopLoss,
} from '../binance/binance.js';

import { getActivePositions } from './positions.js';

const TRADE_MODE = process.env.TRADE_MODE || 'paper';

// Отримати останню mark price з Binance
async function getMarkPrice(symbol) {
  try {
    const res = await axios.get("https://fapi.binance.com/fapi/v1/premiumIndex", {
      params: { symbol },
    });
    return parseFloat(res.data.markPrice);
  } catch (e) {
    console.error(`❌ Failed to fetch markPrice for ${symbol}:`, e.message);
    return null;
  }
}

export async function monitorPositions({ symbol, strategy }) {
  let positions = await getActivePositions(symbol);
  if (!positions.length) return;

  const price = await getMarkPrice(symbol);
  if (price == null) return;

  for (let pos of positions) {
    const { side, entryPrice, size } = pos;
    const dir = side === 'LONG' ? 1 : -1;
    const binanceSide = side === 'LONG' ? 'BUY' : 'SELL';

    /* ===== 1) TRAILING ===== */
    const trailingCfg = strategy?.exits?.trailing;
    if (trailingCfg?.use && entryPrice) {
      const movePct = ((price - entryPrice) / entryPrice) * 100 * dir;

      if (!pos.trailing?.active && movePct >= trailingCfg.startAfterPct) {
        pos.trailing = {
          active: true,
          startAfterPct: trailingCfg.startAfterPct,
          trailStepPct: trailingCfg.trailStepPct,
          anchor: price,
        };
        console.log(`🔛 Trailing activated for ${symbol} @ ${price}`);
      }

      if (pos.trailing?.active) {
        if (side === 'LONG' && price > (pos.trailing.anchor || 0)) {
          pos.trailing.anchor = price;
        }
        if (side === 'SHORT' && price < (pos.trailing.anchor || Infinity)) {
          pos.trailing.anchor = price;
        }

        const newStop =
            side === 'LONG'
                ? pos.trailing.anchor * (1 - trailingCfg.trailStepPct / 100)
                : pos.trailing.anchor * (1 + trailingCfg.trailStepPct / 100);

        if (
            (side === 'LONG' && (!pos.stopPrice || newStop > pos.stopPrice)) ||
            (side === 'SHORT' && (!pos.stopPrice || newStop < pos.stopPrice))
        ) {
          if (TRADE_MODE === 'live') {
            await cancelStopOrders(symbol); // ❗ лишаємо TP, видаляємо тільки SL
            await placeStopLoss(symbol, side, newStop, size / price);
            console.log(
                `🛑 [LIVE] Trailing SL updated @ ${newStop} (anchor=${pos.trailing.anchor})`
            );
          } else {
            console.log(
                `🛑 [PAPER] Trailing SL simulated @ ${newStop} (anchor=${pos.trailing.anchor})`
            );
          }
        }
      }
    }

    /* ===== 2) DCA / Adds ===== */
    const { sizing } = strategy;
    if (sizing && (pos.adds || 0) < sizing.maxAdds) {
      const movePct = (sizing.addOnAdverseMovePct || 0) / 100;
      const adversePrice =
          side === 'LONG'
              ? entryPrice * (1 - movePct)
              : entryPrice * (1 + movePct);

      const condition =
          (side === 'LONG' && price <= adversePrice) ||
          (side === 'SHORT' && price >= adversePrice);

      if (condition) {
        const addSize =
            (pos.initialSizeUsd * (sizing.addMultiplier || 1)) / price;
        if (TRADE_MODE === 'live') {
          try {
            await openMarketOrder(symbol, binanceSide, addSize.toFixed(3));
            console.log(
                `➕ [LIVE] Added ${addSize.toFixed(3)} ${symbol} @ ${price}`
            );
          } catch (err) {
            console.error('❌ Add order failed:', err?.message || err);
          }
        } else {
          console.log(`➕ [PAPER] Add simulated for ${symbol} @ ${price}`);
        }
      }
    }
  }
}