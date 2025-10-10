import axios from 'axios';
import EventEmitter from 'events';
import WebSocket, { type RawData } from 'ws';
import logger from '../../utils/db-logger';

const WS_BASE =
  process.env.BINANCE_WS_PUBLIC_BASE || 'wss://fstream.binance.com';
const REST_BASE = process.env.BINANCE_REST_BASE || 'https://fapi.binance.com';
const FREQ_SUFFIX = (process.env.MARK_PRICE_WS_FREQ || '@1s').trim(); // '', '@1s'
const STALE_AFTER_MS = Number(process.env.MARK_PRICE_STALE_MS || 7000);
const COLD_START_FALLBACK_MS = Number(
  process.env.MARK_PRICE_COLD_START_MS || 1200,
);
const MAX_BACKOFF_MS = Number(process.env.MARK_PRICE_MAX_BACKOFF_MS || 5000);

export type MarkSource = 'ws' | 'rest-cold-start';

export interface MarkEntry {
  symbol: string;
  markPrice: number;
  indexPrice: number | null;
  fundingRate: number | null;
  nextFundingTime: number | null; // ms epoch
  ts: number; // ms epoch of reception
  source: MarkSource;
}

export interface MarkRead extends MarkEntry {
  stale: boolean;
}

type MarkPayload = any;

class MarkPriceHub extends EventEmitter {
  private ws: WebSocket | null = null;
  private state = new Map<string, MarkEntry>();
  private _connecting = false;
  private _closedByUs = false;
  private _backoff = 0;
  private _freq: string = FREQ_SUFFIX;

  // типізовані підписи подій
  public override on(
    event: 'mark',
    listener: (payload: MarkEntry) => void,
  ): this;
  public override on(event: string, listener: (...args: any[]) => void): this;
  public override on(event: string, listener: (...args: any[]) => void): this {
    return super.on(event, listener);
  }
  public override off(
    event: 'mark',
    listener: (payload: MarkEntry) => void,
  ): this;
  public override off(event: string, listener: (...args: any[]) => void): this;
  public override off(event: string, listener: (...args: any[]) => void): this {
    return super.off(event, listener);
  }
  public override emit(event: 'mark', payload: MarkEntry): boolean;
  public override emit(event: string, ...args: any[]): boolean;
  public override emit(event: string, ...args: any[]): boolean {
    return super.emit(event, ...args);
  }

  init(opts?: { frequency?: string }): this {
    if (opts?.frequency) this._freq = opts.frequency;
    this._ensureConnected();
    return this;
  }

  getMark(symbol: string): MarkRead | null {
    if (!symbol) return null;
    const entry = this.state.get(symbol.toUpperCase());
    if (!entry) return null;
    const stale = Date.now() - entry.ts > STALE_AFTER_MS;
    return { ...entry, stale };
  }

  async waitForMark(
    symbol: string,
    timeoutMs: number = COLD_START_FALLBACK_MS,
    useRestFallback = true,
  ): Promise<MarkEntry | null> {
    const s = symbol.toUpperCase();
    const cached = this.getMark(s);
    if (cached && !cached.stale) return cached;

    let timer: NodeJS.Timeout | null = null;

    const firstTick: Promise<MarkEntry | null> = new Promise((resolve) => {
      const onTick = (payload: MarkEntry) => {
        if (payload?.symbol === s) {
          this.off('mark', onTick);
          resolve(payload);
        }
      };
      this.on('mark', onTick);
      timer = setTimeout(() => {
        this.off('mark', onTick);
        resolve(null);
      }, timeoutMs);
    });

    const result = await firstTick;
    if (timer) clearTimeout(timer);
    if (result) return result;

    if (!useRestFallback) return null;

    try {
      const res = await axios.get(`${REST_BASE}/fapi/v1/premiumIndex`, {
        params: { symbol: s },
      });
      const price = parseFloat(res?.data?.markPrice);
      if (Number.isFinite(price)) {
        const entry: MarkEntry = {
          symbol: s,
          markPrice: price,
          indexPrice: parseFloat(res?.data?.indexPrice) || null,
          fundingRate:
            typeof res?.data?.lastFundingRate === 'string'
              ? parseFloat(res.data.lastFundingRate)
              : res?.data?.lastFundingRate != null
                ? Number(res.data.lastFundingRate)
                : null,
          nextFundingTime: Number(res?.data?.nextFundingTime) || null,
          ts: Date.now(),
          source: 'rest-cold-start',
        };
        this.state.set(s, entry);
        this.emit('mark', entry);
        return entry;
      }
    } catch (err: any) {
      logger.warn(
        `⚠️ mark-price-hub REST fallback failed for ${s}: ${err?.message}`,
      );
    }
    return null;
  }

  hasFresh(symbol: string): boolean {
    const v = this.getMark(symbol);
    return !!(v && !v.stale);
  }

  private _ensureConnected(): void {
    if (this._connecting || (this.ws && this.ws.readyState === WebSocket.OPEN))
      return;

    this._connecting = true;
    this._closedByUs = false;

    const stream = `!markPrice@arr${this._freq || ''}`;
    const url = `${WS_BASE}/stream?streams=${encodeURIComponent(stream)}`;

    try {
      this.ws = new WebSocket(url);
    } catch (e: any) {
      this._connecting = false;
      logger.error(`❌ mark-price-hub failed to construct WS: ${e?.message}`);
      this._scheduleReconnect();
      return;
    }

    this.ws.on('open', () => {
      this._connecting = false;
      this._backoff = 0;
      logger.info(`[mark-price-hub] WS connected (arr) → ${url}`);
    });

    this.ws.on('message', (raw: RawData) => this._onMessage(raw));
    this.ws.on('error', (err: any) => {
      logger.error(`❌ [mark-price-hub] WS error: ${err?.message}`);
    });
    this.ws.on('close', (code: number, reason: Buffer) => {
      this._connecting = false;
      this.ws = null;
      if (this._closedByUs) {
        logger.info(`[mark-price-hub] WS closed by app (code=${code})`);
        return;
      }
      logger.warn(`[mark-price-hub] WS closed (code=${code}) reason=${reason}`);
      this._scheduleReconnect();
    });
  }

  private _scheduleReconnect(): void {
    if (this._closedByUs) return;
    this._backoff = Math.min(
      this._backoff ? this._backoff * 2 : 500,
      MAX_BACKOFF_MS,
    );
    setTimeout(() => this._ensureConnected(), this._backoff);
  }

  private _onMessage(raw: RawData): void {
    let msg: any;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    const payload = msg?.data ?? msg;
    if (Array.isArray(payload)) {
      for (const it of payload) this._applyEntry(it);
      return;
    }
    this._applyEntry(payload);
  }

  private _applyEntry(it: MarkPayload): void {
    // Очікувані поля: 's' (symbol), 'p' (markPrice), 'i' (indexPrice), 'r' (lastFundingRate), 'T' (nextFundingTime)
    const s = it?.s ?? it?.symbol;
    const p = it?.p ?? it?.markPrice;
    if (!s || p == null) return;

    const symbol = String(s).toUpperCase();
    const entry: MarkEntry = {
      symbol,
      markPrice: Number(p),
      indexPrice:
        it?.i != null
          ? Number(it.i)
          : it?.indexPrice != null
            ? Number(it.indexPrice)
            : null,
      fundingRate:
        it?.r != null
          ? Number(it.r)
          : it?.lastFundingRate != null
            ? Number(it.lastFundingRate)
            : null,
      nextFundingTime:
        it?.T != null
          ? Number(it.T)
          : it?.nextFundingTime != null
            ? Number(it.nextFundingTime)
            : null,
      ts: Date.now(),
      source: 'ws',
    };

    if (!Number.isFinite(entry.markPrice)) return;

    this.state.set(symbol, entry);
    this.emit('mark', entry);
  }

  /** Зупинити (переважно для тестів/перезапуску) */
  stop(): void {
    if (this.ws) {
      this._closedByUs = true;
      try {
        this.ws.terminate();
      } catch {}
      this.ws = null;
    }
  }
}

// Singleton
export const markPriceHub = new MarkPriceHub();
export default markPriceHub;
