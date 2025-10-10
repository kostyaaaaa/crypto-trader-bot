import axios from 'axios';
import type { IFundingModule } from 'crypto-trader-db';
import logger from '../../utils/db-logger';

interface BinanceFundingRate {
  symbol: string;
  fundingRate: string;
  fundingTime: number;
}
interface FundingPoint {
  symbol: string;
  time: string;
  fundingRate: number;
}
export async function analyzeFunding(
  symbol: string = 'ETHUSDT',
  window: number = 60,
): Promise<IFundingModule | null> {
  try {
    const url = 'https://fapi.binance.com/fapi/v1/fundingRate';
    const res = await axios.get<BinanceFundingRate[]>(url, {
      params: { symbol, limit: window },
    });

    const rows = Array.isArray(res.data) ? res.data : [];
    if (rows.length === 0) {
      logger.warn(`⚠️ No funding data for ${symbol}`);
      return null;
    }

    const hoursCovered = window * 8;
    const daysCovered = (hoursCovered / 24).toFixed(1);

    const candles: FundingPoint[] = rows.map((fr) => ({
      symbol,
      time: new Date(fr.fundingTime).toISOString(),
      fundingRate: parseFloat(fr.fundingRate),
    }));

    if (candles.length < window) {
      return null;
    }

    const avgFunding =
      candles.reduce((s, c) => s + (c.fundingRate || 0), 0) / candles.length;

    const EPS = 0.00002;

    let signal: string = 'NEUTRAL';
    let longScore = 50;
    let shortScore = 50;

    if (Math.abs(avgFunding) > EPS) {
      if (avgFunding > 0) {
        signal = 'SHORT';
        shortScore = Math.min(100, 50 + avgFunding * 1000);
        longScore = 100 - shortScore;
      } else {
        signal = 'LONG';
        longScore = Math.min(100, 50 + Math.abs(avgFunding) * 1000);
        shortScore = 100 - longScore;
      }
    }

    const LONG = Math.round(longScore);
    const SHORT = Math.round(shortScore);

    if (LONG === SHORT) {
      signal = 'NEUTRAL';
    } else {
      signal = LONG > SHORT ? ('LONG' as const) : ('SHORT' as const);
    }

    return {
      module: 'funding',
      symbol,
      signal,
      strength: Math.max(LONG, SHORT),
      meta: {
        LONG,
        SHORT,
        candlesUsed: candles.length,
        avgFunding: Number(avgFunding.toFixed(5)),
        periodCovered: `${hoursCovered}h (~${daysCovered} days)`,
      },
    };
  } catch (e: any) {
    logger.error(
      `❌ Funding fetch/analyze error for ${symbol}:`,
      e?.message ?? e,
    );
    return null;
  }
}
