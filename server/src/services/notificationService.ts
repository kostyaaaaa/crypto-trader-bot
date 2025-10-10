import axios from 'axios';
import { IPosition } from 'crypto-trader-db';
import logger from '../utils/Logger.js';

/**
 * Sends a notification to Telegram
 * Required env: TG_TOKEN, TG_CHAT_ID
 */
export async function sendTelegramNotification(text: string): Promise<void> {
  const token = process.env.TG_TOKEN;
  const chatId = process.env.TG_CHAT_ID;

  if (!token || !chatId) {
    logger.error(
      'Telegram not configured (TG_TOKEN/TG_CHAT_ID missing). Message:\n',
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
    logger.info('Telegram notification sent successfully');
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error('Failed to send telegram message:', errorMessage);
  }
}

/**
 * Formats price field or returns "—"
 */
function formatPrice(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value)
    ? value.toString()
    : '—';
}

/**
 * Builds a link to the console Positions page with opened row (?pos=<id>)
 */

type IdLike = string | { toString(): string }; // | Types.ObjectId

function buildPositionLink(
  position: (Partial<IPosition> & { _id?: IdLike }) | null,
): string | null {
  try {
    const base = process.env.FRONTEND_URL || '';
    if (!base || !position || !position._id) return null;

    const clean = base.replace(/\/+$/, '');
    const id =
      typeof position._id === 'string' ? position._id : position._id.toString();

    return `${clean}/positions?pos=${id}`;
  } catch {
    return null;
  }
}

/**
 * Sends trade notification for position closure
 */
export async function notifyPositionClosed(position: IPosition): Promise<void> {
  try {
    const symbol = position.symbol ?? 'UNKNOWN';
    const side = position.side ?? 'UNKNOWN';
    const entryPrice = position.entryPrice ?? null;
    const size = position.size ?? null;
    const leverage = position.meta?.leverage ?? null;
    const stopLoss = position.stopPrice ?? null;
    const tps = position.takeProfits ?? [];
    const closedBy = position.closedBy ?? 'MANUAL';
    const openedAt = position.openedAt
      ? new Date(position.openedAt).toISOString()
      : '—';
    const finalPnl = position.finalPnl ?? null;
    const closedAt = position.closedAt
      ? new Date(position.closedAt).toISOString()
      : '—';

    // Build TP text
    let tpText = '—';
    if (Array.isArray(tps) && tps.length) {
      tpText = tps
        .map((tp: unknown, i: number) => {
          // Allow for legacy shapes where TP may contain size/qty and optional pct (ROI distance)
          const t = tp as {
            price?: number;
            sizePct?: number;
            size?: number;
            qty?: number;
            pct?: number;
          };
          const p = t.price ?? undefined;
          const rawSize = t.sizePct ?? t.size ?? t.qty;
          const sz =
            typeof rawSize === 'number' && Number.isFinite(rawSize)
              ? rawSize
              : undefined;

          const pctText =
            typeof t.pct === 'number' && Number.isFinite(t.pct)
              ? `, ${t.pct > 0 ? '+' : ''}${t.pct}%`
              : '';

          return `TP${i + 1}: ${formatPrice(p)} (${sz ?? '—'}%${pctText})`;
        })
        .join('\n');
    }

    // Determine emoji based on PnL
    const pnlNum = Number(finalPnl ?? 0);
    const emoji = pnlNum > 0 ? '✅' : pnlNum < 0 ? '❌' : '➖';

    const header = `${emoji} *${symbol}* — *CLOSED* (${closedBy})\n`;
    const link = buildPositionLink(position);
    const linkLine = link ? `\n🔗 ${link}` : '';

    const body = [
      `Side: *${side}*`,
      finalPnl ? `PNL: ${finalPnl}$` : '',
      `Entry: ${formatPrice(entryPrice)}`,
      `Size (USD notional): ${size ? Number(size).toFixed(2) + ' $' : '—'}`,
      `Leverage: ${leverage ?? '—'}x`,
      `SL: ${formatPrice(stopLoss)}`,
      `TPs:\n${tpText}`,
      `Opened: ${openedAt}`,
      `Closed: ${closedAt}`,
    ].join('\n');

    const text = `${header}\n${body}${linkLine}`;
    await sendTelegramNotification(text);
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error('notifyPositionClosed failed:', errorMessage);
  }
}
