// state.ts
import { client } from './client.ts';
import type { FuturesPositionRisk, OpenOrder, SymbolInfo } from './types.ts';

interface Cache<T> {
  data: T | null;
  ts: number;
  inflight: Promise<T> | null;
}

export const POS_RISK_TTL_MS = 1200;
export const OPEN_ORD_TTL_MS = 2000;
export const EX_INFO_TTL_MS = 10 * 60 * 1000;

const posRiskCache: Cache<FuturesPositionRisk[]> = {
  data: null,
  ts: 0,
  inflight: null,
};

const openOrdersCache = new Map<string, Cache<OpenOrder[]>>();

const exInfoCache: Cache<{ symbols: SymbolInfo[] }> = {
  data: null,
  ts: 0,
  inflight: null,
};

/* ========= Positions ========= */
export async function getPositionRiskCached(): Promise<FuturesPositionRisk[]> {
  const now = Date.now();

  // dedup in-flight
  if (posRiskCache.inflight) return posRiskCache.inflight;

  // fresh cached data
  if (posRiskCache.data && now - posRiskCache.ts < POS_RISK_TTL_MS) {
    return posRiskCache.data!; // non-null by guard
  }

  // fetch & populate cache
  posRiskCache.inflight = client
    .futuresPositionRisk()
    .then((res: FuturesPositionRisk[]) => {
      posRiskCache.data = res;
      posRiskCache.ts = Date.now();
      posRiskCache.inflight = null;
      return res;
    })
    .catch((e: any) => {
      posRiskCache.inflight = null;
      throw e;
    });

  return posRiskCache.inflight!;
}

/* ========= Open orders per symbol ========= */
export async function getOpenOrdersCached(
  symbol: string,
): Promise<OpenOrder[]> {
  const now = Date.now();

  let entry = openOrdersCache.get(symbol);
  if (!entry) {
    entry = { data: null, ts: 0, inflight: null };
    openOrdersCache.set(symbol, entry);
  }

  if (entry.inflight) return entry.inflight;

  if (entry.data && now - entry.ts < OPEN_ORD_TTL_MS) {
    return entry.data!; // non-null by guard
  }

  entry.inflight = client
    .futuresOpenOrders({ symbol })
    .then((res: OpenOrder[]) => {
      openOrdersCache.set(symbol, {
        data: res,
        ts: Date.now(),
        inflight: null,
      });
      return res;
    })
    .catch((e: any) => {
      openOrdersCache.set(symbol, { data: null, ts: 0, inflight: null });
      throw e;
    });

  return entry.inflight!;
}

/* ========= Exchange info (for filters etc.) ========= */
export async function getExchangeInfoCached(): Promise<{
  symbols: SymbolInfo[];
}> {
  const now = Date.now();

  if (exInfoCache.inflight) return exInfoCache.inflight!;

  if (exInfoCache.data && now - exInfoCache.ts < EX_INFO_TTL_MS) {
    return exInfoCache.data!; // non-null by guard
  }

  exInfoCache.inflight = client
    .futuresExchangeInfo()
    .then((res: { symbols: SymbolInfo[] }) => {
      exInfoCache.data = res;
      exInfoCache.ts = Date.now();
      exInfoCache.inflight = null;
      return res;
    })
    .catch((e: any) => {
      exInfoCache.inflight = null;
      throw e;
    });

  return exInfoCache.inflight!;
}
