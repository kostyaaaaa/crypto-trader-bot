import { type IEMASeed } from 'crypto-trader-db';

export interface EMAOptions {
  seed?: IEMASeed;
}

export function EMA(
  values: number[],
  period: number,
  { seed = 'sma' }: EMAOptions = {},
): number | null {
  if (!Array.isArray(values) || values.length < period) return null;

  const arr = values.map(Number).filter((v): v is number => Number.isFinite(v));
  if (arr.length < period) return null;

  const k = 2 / (period + 1);

  let ema: number;
  let startIdx: number;

  if (seed === 'first') {
    ema = arr[0];
    startIdx = 1;
  } else {
    const sm = arr.slice(0, period).reduce((s, v) => s + v, 0) / period;
    ema = sm;
    startIdx = period;
  }

  for (let i = startIdx; i < arr.length; i++) {
    ema = arr[i] * k + ema * (1 - k);
  }
  return Number.isFinite(ema) ? ema : null;
}

export function RSI(values: number[], period: number = 14): number | null {
  if (!Array.isArray(values) || values.length < period + 1) return null;

  const arr = values.map(Number).filter((v): v is number => Number.isFinite(v));
  if (arr.length < period + 1) return null;

  let gains = 0;
  let losses = 0;

  for (let i = arr.length - period; i < arr.length; i++) {
    const diff = arr[i] - arr[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }

  const rs = gains / (losses || 1);
  const rsi = 100 - 100 / (1 + rs);
  return Number.isFinite(rsi) ? rsi : null;
}

export function SMA(values: number[], p: number): number | null {
  if (!Array.isArray(values) || values.length < p) return null;

  const arr = values.map(Number).filter((v): v is number => Number.isFinite(v));
  if (arr.length < p) return null;

  const sum = arr.slice(-p).reduce((s, v) => s + v, 0);
  const sma = sum / p;
  return Number.isFinite(sma) ? sma : null;
}
