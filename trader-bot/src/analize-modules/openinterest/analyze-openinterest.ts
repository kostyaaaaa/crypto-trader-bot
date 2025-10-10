import axios, { type AxiosResponse } from 'axios';

import type { IOpenInterestModule } from 'crypto-trader-db';
import type { BinanceKline, OIHistItem } from '../../types/index.ts';
import logger from '../../utils/db-logger.ts';

export async function analyzeOpenInterest(
  symbol: string = 'ETHUSDT',
  window: number = 5,
): Promise<IOpenInterestModule | null> {
  try {
    const oiRes: AxiosResponse<OIHistItem[]> = await axios.get(
      'https://fapi.binance.com/futures/data/openInterestHist',
      { params: { symbol, period: '5m', limit: window } },
    );
    const oiData = oiRes.data ?? [];
    if (!Array.isArray(oiData) || oiData.length < window) return null;

    const klineRes: AxiosResponse<BinanceKline[]> = await axios.get(
      'https://fapi.binance.com/fapi/v1/klines',
      { params: { symbol, interval: '5m', limit: window } },
    );
    const klineData = klineRes.data ?? [];
    if (!Array.isArray(klineData) || klineData.length < window) return null;

    const recent = Array.from({ length: window }, (_, i) => ({
      openInterest: parseFloat(oiData[i].sumOpenInterest),
      openInterestValue: parseFloat(oiData[i].sumOpenInterestValue),
      price: parseFloat(klineData[i][4] as string),
    }));

    const first = recent[0];
    const last = recent[recent.length - 1];

    // захист від ділення на 0
    const safePct = (end: number, start: number): number =>
      Number.isFinite(start) && start !== 0 ? ((end - start) / start) * 100 : 0;

    const oiChangePct = safePct(last.openInterest, first.openInterest);
    const oiValueChangePct = safePct(
      last.openInterestValue,
      first.openInterestValue,
    );
    const priceChangePct = safePct(last.price, first.price);

    const sameDirection =
      (oiChangePct >= 0 && priceChangePct >= 0) ||
      (oiChangePct < 0 && priceChangePct < 0);
    const sign = sameDirection ? +1 : -1;

    const mag = 0.6 * Math.abs(oiChangePct) + 0.4 * Math.abs(priceChangePct);
    if (mag < 0.05) {
      return {
        module: 'openInterest',
        symbol,
        signal: 'NEUTRAL',
        strength: 0,
        meta: {
          LONG: 50,
          SHORT: 50,
          candlesUsed: recent.length,
          periodCovered: `${window * 5}m (~${((window * 5) / 60).toFixed(1)}h)`,
          oiChangePct: to2(oiChangePct),
          oiValueChangePct: to2(oiValueChangePct),
          priceChangePct: to2(priceChangePct),
        },
      };
    }

    const k = 0.35;
    const pLong = 1 / (1 + Math.exp(-k * sign * mag));
    const longScore = Math.round(pLong * 100);
    const shortScore = 100 - longScore;

    let signal: string = 'LONG';
    if (shortScore > longScore) signal = 'SHORT';
    if (Math.abs(longScore - shortScore) < 5) signal = 'NEUTRAL';

    return {
      module: 'openInterest',
      symbol,
      signal,
      strength: Math.max(longScore, shortScore),
      meta: {
        LONG: longScore,
        SHORT: shortScore,
        candlesUsed: recent.length,
        periodCovered: `${window * 5}m (~${((window * 5) / 60).toFixed(1)}h)`,
        oiChangePct: to2(oiChangePct),
        oiValueChangePct: to2(oiValueChangePct),
        priceChangePct: to2(priceChangePct),
      },
    };
  } catch (err: any) {
    logger.error('❌ analyzeOpenInterest error:', err?.message ?? err);
    return null;
  }
}

function to2(x: number): number {
  return Number.isFinite(x) ? Number(x.toFixed(2)) : 0;
}
