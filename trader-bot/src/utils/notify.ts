// utils/notify.js
import axios from 'axios';
import logger from './db-logger.ts';

// Builds a link to the console Positions page with opened row (?pos=<id>)
function buildPositionLink(pos) {
  try {
    const base = process.env.FRONTEND_URL || '';
    if (!base || !pos || !pos._id) return null;
    const clean = base.replace(/\/+$/, '');
    return `${clean}/positions?pos=${pos._id}`;
  } catch {
    return null;
  }
}

/**
 * Відправляє повідомлення в Telegram (або лог)
 * Потрібні env: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
 */
async function sendTelegram(text) {
  const token = process.env.TG_TOKEN;
  const chatId = process.env.TG_CHAT_ID;
  if (!token || !chatId) {
    logger.error(
      'Telegram not configured (TELEGRAM_BOT_TOKEN/CHAT_ID missing). Message:\n',
      text,
    );
    return;
  }

  try {
    await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
    });
  } catch (err) {
    logger.error('Failed to send telegram message:', err?.message || err);
  }
}

/**
 * Форматує поле ціни або повертає "—"
 */
function fmtPrice(v) {
  return typeof v === 'number' && Number.isFinite(v) ? v.toString() : '—';
}

/**
 * notifyTrade(position, action)
 * - position: об'єкт позиції / закритої позиції (повинен містити symbol, side, entryPrice, size, leverage, stopLoss, takeProfits, closedBy, finalPnl, openedAt, closedAt)
 * - action: 'CLOSED' | 'OPEN' | 'UPDATE' (за замовчуванням 'UPDATE')
 */
export async function notifyTrade(position = {}, action = 'UPDATE') {
  try {
    const symbol = position.symbol ?? 'UNKNOWN';
    const side = position.side ?? 'UNKNOWN';
    const status = position.status ?? 'UNKNOWN';

    const entryPrice = position.entryPrice ?? position.initialEntry ?? null;
    const size = position.size ?? position.initialSizeUsd ?? null;
    const leverage =
      position.leverage ?? (position.meta && position.meta.leverage) ?? null;
    const stopLoss = position.stopPrice ?? position.stopLoss ?? null;
    const tps = position.takeProfits ?? position.initialTPs ?? [];
    const closedBy =
      position.closedBy ?? position.closedReason ?? position.reason ?? null;
    const openedAt = position.openedAt
      ? new Date(position.openedAt).toISOString()
      : position.initialOpenedAt
        ? new Date(position.initialOpenedAt).toISOString()
        : '—';
    const PNL = position.finalPnl ?? null;
    const closedAt = position.closedAt
      ? new Date(position.closedAt).toISOString()
      : '—';

    // build TP text
    let tpText = '—';
    if (Array.isArray(tps) && tps.length) {
      tpText = tps
        .map((tp, i) => {
          const p = tp.price ?? '—';
          const sz = tp.sizePct ?? tp.size ?? tp.qty ?? '—';
          const pct =
            tp.pct !== undefined ? `, ${tp.pct > 0 ? '+' : ''}${tp.pct}%` : '';
          return `TP${i + 1}: ${fmtPrice(p)} (${sz}%${pct})`;
        })
        .join('\n');
    }

    // message depending on action
    let header = '';
    if (action === 'CLOSED') {
      const pnlNum = Number(position.finalPnl ?? position.realizedPnl ?? 0);
      const emoji = pnlNum > 0 ? '✅' : pnlNum < 0 ? '❌' : '➖';

      let reason = closedBy ?? 'CLOSED';
      const hadTrail = Array.isArray(position.adjustments)
        ? position.adjustments.some(
            (a) =>
              a?.type === 'SL_UPDATE' &&
              /TRAIL|BREAKEVEN/i.test(a?.reason || ''),
          )
        : false;
      const beByPrice =
        entryPrice != null &&
        stopLoss != null &&
        ((side === 'LONG' && stopLoss >= entryPrice) ||
          (side === 'SHORT' && stopLoss <= entryPrice));
      if (reason === 'SL' && (hadTrail || beByPrice)) {
        reason = 'SL (trail)';
      }

      header = `${emoji} *${symbol}* — *CLOSED* (${reason})\n`;
    } else if (action === 'OPEN') {
      header = `🟢 *${symbol}* — *OPENED* (${side})\n`;
    } else {
      header = `ℹ️ *${symbol}* — ${status}\n`;
    }
    const link = buildPositionLink(position);
    const linkLine = link ? `\n🔗 ${link}` : '';
    const body = [
      `Side: *${side}*`,
      !!PNL ? `PNL: ${PNL}$` : '',
      `Entry: ${fmtPrice(entryPrice)}`,
      `Size (USD notional): ${size ? Number(size).toFixed(2) + ' $' : '—'}`,
      `Leverage: ${leverage ?? '—'}x`,
      `SL: ${fmtPrice(stopLoss)}`,
      `TPs:\n${tpText}`,
      `Opened: ${openedAt}`,
      `Closed: ${closedAt}`,
    ].join('\n');

    const text = `${header}\n${body}${linkLine}`;

    await sendTelegram(text);
  } catch (err) {
    logger.error('notifyTrade failed:', err?.message || err);
  }
}

export default notifyTrade;

export { buildPositionLink };
