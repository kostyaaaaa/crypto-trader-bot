import axios from 'axios';
import logger from '../../utils/db-logger.ts';

type IncomeType = 'REALIZED_PNL' | string;

interface IncomeRow {
  symbol: string;
  incomeType: IncomeType;
  income: number;
  asset: string;
  time: number; // ms epoch
}

function normalize(r: any): IncomeRow {
  return {
    symbol: String(r.symbol),
    incomeType: String(r.incomeType),
    income: Number(r.income),
    asset: String(r.asset ?? 'USDT'),
    time: Number(r.time ?? r.tranTime ?? Date.now()),
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

  private constructor() {}

  start(): void {
    if (this.started) return;
    this.started = true;
    this.pollOnce().catch((e) =>
      logger.warn(`CooldownHub first poll failed: ${e?.message || e}`),
    );
    this.timer = setInterval(() => {
      this.pollOnce().catch((e) =>
        logger.warn(`CooldownHub poll failed: ${e?.message || e}`),
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
    // Якщо у тебе вже є обгортка для signed-запитів до Binance — підстав її тут
    const { data } = await axios.get(
      'https://fapi.binance.com/fapi/v1/income',
      {
        params: {
          incomeType: 'REALIZED_PNL',
          limit: 100,
          // за потреби: startTime: Date.now() - 24*60*60*1000
        },
        // headers: {...} // підпис/ключі, якщо викликаєш не через свій binance.js
      },
    );

    if (Array.isArray(data)) {
      for (const r of data) this.upsert(normalize(r));
    }
  }
}

const cooldownHub = CooldownHub.instance;
export default cooldownHub;
