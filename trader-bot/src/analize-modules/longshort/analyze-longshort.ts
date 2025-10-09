import axios from 'axios';
import type { ILongShortModule } from 'crypto-trader-db';
import logger from '../../utils/db-logger.ts';

type GLSRow = {
  symbol: string;
  longAccount: string;
  shortAccount: string;
  longShortRatio: string;
  timestamp: number;
};

export async function analyzeLongShort(
  symbol: string = 'ETHUSDT',
  window: number = 5,
): Promise<ILongShortModule | null> {
  try {
    const url =
      'https://fapi.binance.com/futures/data/globalLongShortAccountRatio';
    const res = await axios.get<GLSRow[]>(url, {
      params: { symbol, period: '5m', limit: window },
    });

    const rows = Array.isArray(res.data) ? res.data : [];
    if (rows.length < window) return null;

    const data = rows.map((d) => {
      const longFrac = Number.parseFloat(d.longAccount);
      const shortFrac = Number.parseFloat(d.shortAccount);
      const ratio = Number.parseFloat(d.longShortRatio);
      return {
        time: new Date(d.timestamp).toISOString(),
        longPct: Number.isFinite(longFrac) ? longFrac * 100 : 0,
        shortPct: Number.isFinite(shortFrac) ? shortFrac * 100 : 0,
        ratio: Number.isFinite(ratio) ? ratio : 1,
      };
    });

    const avgLong = data.reduce((s, c) => s + c.longPct, 0) / data.length;
    const avgShort = data.reduce((s, c) => s + c.shortPct, 0) / data.length;

    const total = avgLong + avgShort;
    const longPct = total > 0 ? (avgLong / total) * 100 : 50;
    const shortPct = total > 0 ? (avgShort / total) * 100 : 50;

    const diff = Math.abs(longPct - shortPct);
    let signal: string = 'NEUTRAL';
    if (diff > 5) signal = longPct > shortPct ? 'LONG' : 'SHORT';

    const strength = Number(diff.toFixed(2));

    const minutesCovered = window * 5;
    const hoursCovered = (minutesCovered / 60).toFixed(1);

    return {
      module: 'longShort',
      symbol,
      signal,
      strength,
      meta: {
        LONG: Number(longPct.toFixed(3)),
        SHORT: Number(shortPct.toFixed(3)),
        pointsUsed: data.length,
        avgLong: Number(avgLong.toFixed(2)),
        avgShort: Number(avgShort.toFixed(2)),
        periodCovered: `${minutesCovered}m (~${hoursCovered}h)`,
      },
    };
  } catch (e: any) {
    logger.error('❌ Error fetching long/short ratio:', e?.message || e);
    return null;
  }
}
