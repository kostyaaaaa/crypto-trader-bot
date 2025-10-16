import axios from 'axios';
import type {
  IEMASeed,
  IHigherMAConfig,
  IHigherMAModule,
  IMAType,
} from 'crypto-trader-db';
import type { BinanceKline } from '../../types/index';
import { EMA as calcEMA, SMA } from '../../utils/getEMAAndRSI';
const DEFAULT_CFG: IHigherMAConfig = {
  timeframe: '1d',
  maShort: 7,
  maLong: 14,
  type: 'SMA',
  thresholdPct: 0.2,
  scale: 12,
  emaSeed: 'sma',
};

export async function analyzeHigherMA(
  symbol: string = 'ETHUSDT',
  cfg: Partial<IHigherMAConfig> = {},
): Promise<IHigherMAModule | null> {
  const merged: IHigherMAConfig = { ...DEFAULT_CFG, ...cfg };
  const timeframe: string = merged.timeframe || '1d';
  const maShort: number = Number(merged.maShort ?? 7);
  const maLong: number = Number(merged.maLong ?? 14);
  const type: IMAType = (
    (merged.type || 'SMA') as IMAType
  ).toUpperCase() as IMAType;
  const thresholdPct: number = Number(merged.thresholdPct ?? 0.2);
  const scale: number = Number.isFinite(merged.scale)
    ? Number(merged.scale)
    : 12;
  const emaSeed: IEMASeed = merged.emaSeed || 'sma';

  const limit = Math.max(maLong + 20, 200);
  const res = await axios.get<BinanceKline[]>(
    'https://fapi.binance.com/fapi/v1/klines',
    { params: { symbol, interval: timeframe, limit } },
  );

  const closes = (res.data || [])
    .map((k) => Number(k[4]))
    .filter(Number.isFinite);

  if (closes.length < maLong) return null;

  const s =
    type === 'EMA'
      ? (calcEMA(closes, maShort, { seed: emaSeed }) as number | null)
      : (SMA(closes, maShort) as number | null);

  const l =
    type === 'EMA'
      ? (calcEMA(closes, maLong, { seed: emaSeed }) as number | null)
      : (SMA(closes, maLong) as number | null);

  const price = closes.at(-1);

  if (!Number.isFinite(s) || !Number.isFinite(l) || !Number.isFinite(price)) {
    return null;
  }

  const sNum = Number(s);
  const lNum = Number(l);
  const priceNum = Number(price);

  const delta = sNum - lNum;
  const deltaPct = (delta / priceNum) * 100;
  const priceVsLongPct = ((priceNum - lNum) / lNum) * 100;

  let signal: string = 'NEUTRAL';
  if (Math.abs(deltaPct) >= thresholdPct) {
    signal = delta > 0 ? 'LONG' : 'SHORT';
  }

  const agree =
    (signal === 'LONG' && priceVsLongPct >= 0) ||
    (signal === 'SHORT' && priceVsLongPct <= 0);

  let strength = 0;
  const rampK = 3 * (12 / scale);
  if (signal !== 'NEUTRAL') {
    const over = Math.max(0, Math.abs(deltaPct) - thresholdPct);
    const denom = thresholdPct * rampK || 1;
    strength = Math.min(100, (over / denom) * 100);
    if (!agree) strength *= 0.8;
  }
  strength = Number(strength.toFixed(3));

  const LONG = signal === 'LONG' ? strength : 0;
  const SHORT = signal === 'SHORT' ? strength : 0;

  return {
    type: 'scoring',
    module: 'higherMA',
    symbol,
    meta: {
      LONG,
      SHORT,
      timeframe,
      type,
      maShort,
      maLong,
      maShortVal: Number(sNum.toFixed(6)),
      maLongVal: Number(lNum.toFixed(6)),
      deltaPct: Number(deltaPct.toFixed(3)),
      priceVsLongPct: Number(priceVsLongPct.toFixed(3)),
      closesUsed: closes.length,
      thresholdPct,
      scale,
      rampK,
      emaSeed,
    },
  };
}
