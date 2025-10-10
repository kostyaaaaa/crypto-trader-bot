import axios from 'axios';
import { createHmac } from 'node:crypto';
import logger from '../../utils/db-logger.ts';

type IncomeType = 'REALIZED_PNL' | string;

interface IncomeRow {
  symbol: string;
  incomeType: IncomeType;
  income: number;
  asset: string;
  time: number; // ms epoch
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

const API_KEY = process.env.BINANCE_API_KEY || '';
const API_SECRET = process.env.BINANCE_ACCOUNT_SECRET_KEY || '';
const BASE = 'https://fapi.binance.com';

function signQuery(
  params: Record<string, string | number | undefined>,
): string {
  // drop undefined
  const entries = Object.entries(params).filter(([, v]) => v !== undefined);
  const qs = new URLSearchParams();
  for (const [k, v] of entries) qs.append(k, String(v));
  const signature = createHmac('sha256', API_SECRET)
    .update(qs.toString())
    .digest('hex');
  qs.append('signature', signature);
  return qs.toString();
}

function normalize(r: unknown): IncomeRow {
  const o =
    typeof r === 'object' && r !== null ? (r as Record<string, unknown>) : {};
  const n = (x: unknown): number => {
    const v = Number(x);
    return Number.isFinite(v) ? v : 0;
  };
  const s = (x: unknown, d = ''): string => (x == null ? d : String(x));
  const t = (x: unknown): number => {
    const v = Number((o.time as unknown) ?? (o as any).tranTime);
    return Number.isFinite(v) && v > 0 ? v : Date.now();
  };
  return {
    symbol: s(o.symbol),
    incomeType: s(o.incomeType) as IncomeType,
    income: n(o.income),
    asset: s(o.asset, 'USDT'),
    time: t(o.time),
  };
}

export class CooldownHub {
  private static _inst: CooldownHub | null = null;
  static get instance(): CooldownHub {
    if (!this._inst) this._inst = new CooldownHub();
    return this._inst;
  }

  private started = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastClosedAtBySymbol = new Map<string, Date>();
  private lastPollTs = 0;

  private constructor() {}

  start(): void {
    if (this.started) return;
    if (!API_KEY || !API_SECRET) {
      logger.warn(
        'CooldownHub not started: BINANCE_API_KEY or BINANCE_API_SECRET is missing',
      );
      return;
    }
    this.started = true;
    this.pollOnce().catch((e) =>
      logger.warn(`CooldownHub first poll failed: ${errMsg(e)}`),
    );
    this.timer = setInterval(() => {
      this.pollOnce().catch((e) =>
        logger.warn(`CooldownHub poll failed: ${errMsg(e)}`),
      );
    }, 60_000);
    logger.info('CooldownHub started (income poll each 60s).');
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.started = false;
  }

  isStarted(): boolean {
    return this.started;
  }

  getLastClosedAt(symbol: string): Date | null {
    return this.lastClosedAtBySymbol.get(symbol) ?? null;
  }

  getAll(): Map<string, Date> {
    return new Map(this.lastClosedAtBySymbol);
  }

  private upsert(row: IncomeRow): void {
    if (row.incomeType !== 'REALIZED_PNL') return;
    const t = new Date(row.time);
    const prev = this.lastClosedAtBySymbol.get(row.symbol);
    if (!prev || t > prev) this.lastClosedAtBySymbol.set(row.symbol, t);
  }

  private async pollOnce(): Promise<void> {
    // SIGNED request: /fapi/v1/income
    // We poll the last 24h or since previous poll, whichever is newer
    const now = Date.now();
    const since =
      this.lastPollTs > 0 ? this.lastPollTs - 5_000 : now - 24 * 60 * 60 * 1000; // 5s safety
    this.lastPollTs = now;

    try {
      const params = {
        incomeType: 'REALIZED_PNL',
        startTime: since,
        limit: 1000,
        timestamp: now,
        recvWindow: 10_000,
      } as const;

      const qs = signQuery(params);
      const url = `${BASE}/fapi/v1/income?${qs}`;
      const { data } = await axios.get(url, {
        headers: { 'X-MBX-APIKEY': API_KEY },
      });

      if (Array.isArray(data)) {
        for (const r of data) this.upsert(normalize(r));
      } else {
        logger.warn('CooldownHub income: unexpected response shape');
      }
    } catch (e) {
      // 401/418/429, etc.
      logger.warn(`CooldownHub income poll error: ${errMsg(e)}`);
    }
  }
}

const cooldownHub = CooldownHub.instance;
export default cooldownHub;
