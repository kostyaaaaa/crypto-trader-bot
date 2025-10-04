// src/trading/core/mark-price-hub.js
// ARR-only Mark Price Hub: single WS to !markPrice@arr and synchronous reads.
// Includes one-shot REST cold-start fallback for a symbol if first tick hasn't arrived.

import axios from 'axios';
import EventEmitter from 'events';
import WebSocket from 'ws';
import logger from '../../utils/db-logger.js';

const WS_BASE =
  process.env.BINANCE_WS_PUBLIC_BASE || 'wss://fstream.binance.com';
const REST_BASE = process.env.BINANCE_REST_BASE || 'https://fapi.binance.com';
const FREQ_SUFFIX = (process.env.MARK_PRICE_WS_FREQ || '@1s').trim(); // '', '@1s'
const STALE_AFTER_MS = Number(process.env.MARK_PRICE_STALE_MS || 7000);
const COLD_START_FALLBACK_MS = Number(
  process.env.MARK_PRICE_COLD_START_MS || 1200,
);
const MAX_BACKOFF_MS = Number(process.env.MARK_PRICE_MAX_BACKOFF_MS || 5000);

class MarkPriceHub extends EventEmitter {
  constructor() {
    super();
    this.ws = null;
    this.state = new Map(); // symbol -> { markPrice, indexPrice, fundingRate, nextFundingTime, ts }
    this._connecting = false;
    this._closedByUs = false;
    this._backoff = 0;
    this._freq = FREQ_SUFFIX;
  }

  // Initialize once on app bootstrap
  init({ frequency } = {}) {
    if (frequency) this._freq = frequency;
    this._ensureConnected();
    return this;
  }

  // Synchronous read of the latest known mark price data
  getMark(symbol) {
    if (!symbol) return null;
    const entry = this.state.get(String(symbol).toUpperCase());
    if (!entry) return null;
    const stale = Date.now() - entry.ts > STALE_AFTER_MS;
    return { ...entry, stale };
  }

  // Wait for first tick; applies cold-start REST fallback if no tick in time
  async waitForMark(
    symbol,
    timeoutMs = COLD_START_FALLBACK_MS,
    useRestFallback = true,
  ) {
    const s = String(symbol).toUpperCase();
    const existing = this.getMark(s);
    if (existing && !existing.stale) return existing;

    let timer;
    const firstTick = new Promise((resolve) => {
      const onTick = (payload) => {
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
        const entry = {
          symbol: s,
          markPrice: price,
          indexPrice: parseFloat(res?.data?.indexPrice) || null,
          fundingRate:
            typeof res?.data?.lastFundingRate === 'string'
              ? parseFloat(res.data.lastFundingRate)
              : null,
          nextFundingTime: Number(res?.data?.nextFundingTime) || null,
          ts: Date.now(),
          source: 'rest-cold-start',
        };
        this.state.set(s, entry);
        this.emit('mark', entry);
        return entry;
      }
    } catch (err) {
      logger.warn(
        `⚠️ mark-price-hub REST fallback failed for ${s}: ${err?.message}`,
      );
    }
    return null;
  }

  // Whether we have non-stale data for the symbol
  hasFresh(symbol) {
    const v = this.getMark(symbol);
    return !!(v && !v.stale);
  }

  // ---------- Internal WS lifecycle ----------
  _ensureConnected() {
    if (this._connecting || (this.ws && this.ws.readyState === WebSocket.OPEN))
      return;
    this._connecting = true;
    this._closedByUs = false;

    const stream = `!markPrice@arr${this._freq || ''}`;
    const url = `${WS_BASE}/stream?streams=${encodeURIComponent(stream)}`;
    try {
      this.ws = new WebSocket(url);
    } catch (e) {
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

    this.ws.on('message', (raw) => this._onMessage(raw));
    this.ws.on('error', (err) => {
      logger.error(`❌ [mark-price-hub] WS error: ${err?.message}`);
    });
    this.ws.on('close', (code, reason) => {
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

  _scheduleReconnect() {
    if (this._closedByUs) return;
    this._backoff = Math.min(
      this._backoff ? this._backoff * 2 : 500,
      MAX_BACKOFF_MS,
    );
    setTimeout(() => this._ensureConnected(), this._backoff);
  }

  _onMessage(raw) {
    let msg;
    try {
      msg = JSON.parse(raw);
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

  _applyEntry(it) {
    // Expected fields: 's' symbol, 'p' markPrice, 'i' indexPrice, 'r' lastFundingRate, 'T' nextFundingTime
    const s = it?.s || it?.symbol;
    const p = it?.p ?? it?.markPrice;
    if (!s || p == null) return;

    const symbol = String(s).toUpperCase();
    const entry = {
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

  // Manual stop (mostly for tests)
  stop() {
    if (this.ws) {
      this._closedByUs = true;
      try {
        this.ws.terminate();
      } catch {}
      this.ws = null;
    }
  }
}

// Singleton export
export const markPriceHub = new MarkPriceHub();
export default markPriceHub;
