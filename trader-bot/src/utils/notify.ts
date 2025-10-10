// utils/notify.ts
import axios from 'axios';
import type { IAdjustment, IPosition, ITakeProfit } from 'crypto-trader-db';
import logger from './db-logger';

/* ===================== helpers & types ===================== */

type Maybe<T> = T | null | undefined;

// Позиція, яку ми можемо отримати як відкрита/закрита + legacy-поля з історичного коду
export type NotifyPosition = Partial<IPosition> & {
  _id?: unknown; // mongoose ObjectId | string
  leverage?: number | null; // optional convenience field
  initialEntry?: number; // legacy alias for entryPrice
  initialSizeUsd?: number; // legacy alias for size (USD notional)
  initialTPs?: Array<
    Partial<ITakeProfit> & { size?: number; qty?: number; pct?: number }
  >; // legacy
  initialOpenedAt?: Date | string | number; // legacy
  closedReason?: string; // legacy
  reason?: string; // legacy
};

function toIdString(id: unknown): string | null {
  try {
    if (id == null) return null;
    // Mongoose ObjectId має toString()
    if (typeof id === 'object' && id && 'toString' in id)
      return String((id as { toString(): string }).toString());
    return String(id);
  } catch {
    return null;
  }
}

// Builds a link to the console Positions page with opened row (?pos=<id>)
export function buildPositionLink(
  pos?: { _id?: unknown } | null,
): string | null {
  try {
    const base = process.env.FRONTEND_URL || '';
    const idStr = pos?._id != null ? toIdString(pos._id) : null;
    if (!base || !idStr) return null;
    const clean = base.replace(/\/+$/, '');
    return `${clean}/positions?pos=${idStr}`;
  } catch {
    return null;
  }
}

function fmtPrice(v: Maybe<number>): string {
  return typeof v === 'number' && Number.isFinite(v) ? v.toString() : '—';
}

async function sendTelegram(text: string): Promise<void> {
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
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('Failed to send telegram message:', msg);
  }
}

export async function notifyTrade(
  position: NotifyPosition = {},
  action: 'CLOSED' | 'OPEN' | 'UPDATE' = 'UPDATE',
): Promise<void> {
  try {
    const symbol = position.symbol ?? 'UNKNOWN';
    const side = position.side ?? 'UNKNOWN';
    const status = position.status ?? 'UNKNOWN';

    const entryPrice = position.entryPrice ?? position.initialEntry ?? null;
    const size = position.size ?? position.initialSizeUsd ?? null;
    const leverage = position.leverage ?? position.meta?.leverage ?? null;
    const stopLoss =
      position.stopPrice ??
      (position as { stopLoss?: number }).stopLoss ??
      null;
    const tps: Array<
      Partial<ITakeProfit> & { size?: number; qty?: number; pct?: number }
    > =
      (position.takeProfits as ITakeProfit[] | undefined) ??
      position.initialTPs ??
      [];
    const closedBy =
      position.closedBy ??
      (position as { closedReason?: string }).closedReason ??
      position.reason ??
      null;

    const openedAt = position.openedAt
      ? new Date(position.openedAt).toISOString()
      : position.initialOpenedAt
        ? new Date(position.initialOpenedAt).toISOString()
        : '—';

    const PNL = (position as { finalPnl?: number }).finalPnl ?? null;
    const closedAt = position.closedAt
      ? new Date(position.closedAt).toISOString()
      : '—';

    // build TP text
    let tpText = '—';
    if (Array.isArray(tps) && tps.length) {
      tpText = tps
        .map((tp, i) => {
          const p = (tp as ITakeProfit).price ?? '—';
          const sz =
            (tp as ITakeProfit).sizePct ??
            (tp as { size?: number }).size ??
            (tp as { qty?: number }).qty ??
            '—';
          const pct =
            (tp as { pct?: number }).pct !== undefined
              ? `, ${(tp as { pct?: number }).pct! > 0 ? '+' : ''}${(tp as { pct?: number }).pct}%`
              : '';
          return `TP${i + 1}: ${fmtPrice(typeof p === 'number' ? p : Number(p))} (${sz}%${pct})`;
        })
        .join('\n');
    }

    let header = '';
    if (action === 'CLOSED') {
      const pnlNum = Number(PNL ?? position.realizedPnl ?? 0);
      const emoji = pnlNum > 0 ? '✅' : pnlNum < 0 ? '❌' : '➖';

      let reason = closedBy ?? 'CLOSED';
      const hadTrail = Array.isArray(position.adjustments)
        ? (position.adjustments as IAdjustment[]).some(
            (a) =>
              a?.type === 'SL_UPDATE' &&
              /TRAIL|BREAKEVEN/i.test((a as { reason?: string }).reason || ''),
          )
        : false;
      const beByPrice =
        entryPrice != null &&
        stopLoss != null &&
        ((side === 'LONG' && (stopLoss as number) >= (entryPrice as number)) ||
          (side === 'SHORT' && (stopLoss as number) <= (entryPrice as number)));
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
      PNL != null ? `PNL: ${PNL}$` : '',
      `Entry: ${fmtPrice(typeof entryPrice === 'number' ? entryPrice : Number(entryPrice))}`,
      `Size (USD notional): ${size ? Number(size).toFixed(2) + ' $' : '—'}`,
      `Leverage: ${leverage ?? '—'}x`,
      `SL: ${fmtPrice(typeof stopLoss === 'number' ? stopLoss : Number(stopLoss))}`,
      `TPs:\n${tpText}`,
      `Opened: ${openedAt}`,
      `Closed: ${closedAt}`,
    ]
      .filter(Boolean)
      .join('\n');

    const text = `${header}\n${body}${linkLine}`;

    await sendTelegram(text);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('notifyTrade failed:', msg);
  }
}

export default notifyTrade;
