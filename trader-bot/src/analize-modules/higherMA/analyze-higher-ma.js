// modules/higherMA/analyze-higher-ma.js
// Общий тренд по дневному графику: SMA/EMA(7) vs SMA/EMA(14) + позиция цены
// Возвращает: LONG/SHORT/NEUTRAL и баллы 0..100 по стороне сигнала

import axios from 'axios';

export async function analyzeHigherMA(
  symbol = 'ETHUSDT',
  cfg = {
    timeframe: '1d',
    maShort: 7,
    maLong: 14,
    type: 'SMA', // 'SMA' | 'EMA'
    thresholdPct: 0.2, // порог (в %) для отсечения шума по delta% между MA
    scale: 20, // во что умножать delta%: strength = min(100, |delta%| * scale)
  },
) {
  const timeframe = cfg.timeframe || '1d';
  const maShort = Number(cfg.maShort ?? 7);
  const maLong = Number(cfg.maLong ?? 14);
  const type = (cfg.type || 'SMA').toUpperCase();
  const thresholdPct = Number(cfg.thresholdPct ?? 0.2); // 0.2% по умолчанию
  const scale = Number(cfg.scale ?? 20);

  const limit = Math.max(maLong + 20, 200); // запас по барам
  const res = await axios.get('https://fapi.binance.com/fapi/v1/klines', {
    params: { symbol, interval: timeframe, limit },
  });

  const closes = res.data.map((k) => Number(k[4])).filter(Number.isFinite);
  if (closes.length < maLong) {
    return null;
  }

  const MA = type === 'EMA' ? EMA : SMA;
  const s = MA(closes, maShort);
  const l = MA(closes, maLong);
  const price = closes[closes.length - 1];

  if (!Number.isFinite(s) || !Number.isFinite(l) || !Number.isFinite(price)) {
    return null;
  }

  const delta = s - l;
  const deltaPct = (delta / price) * 100; // разница MA относительно цены, в %
  const priceVsLongPct = ((price - l) / l) * 100;

  // базовый сигнал по направлению креста MA
  let signal = 'NEUTRAL';
  if (Math.abs(deltaPct) >= thresholdPct) {
    signal = delta > 0 ? 'LONG' : 'SHORT';
  }

  // усиливаем уверенность, если цена поддерживает сигнал (выше/ниже длинной MA)
  const agree =
    (signal === 'LONG' && priceVsLongPct >= 0) ||
    (signal === 'SHORT' && priceVsLongPct <= 0);

  // сила: линейно от |delta%| в пределах 0..100
  // пример: delta% = 2% при scale=20 → strength = 40
  let strength = Math.min(100, Math.abs(deltaPct) * scale);
  if (!agree) strength *= 0.6; // небольшое демпфирование, если цена не согласна

  const LONG = signal === 'LONG' ? strength : 0;
  const SHORT = signal === 'SHORT' ? strength : 0;

  return {
    module: 'higherMA',
    symbol,
    signal, // LONG | SHORT | NEUTRAL
    strength, // 0..100
    meta: {
      LONG,
      SHORT,
      timeframe,
      type,
      maShort,
      maLong,
      maShortVal: Number(s.toFixed(6)),
      maLongVal: Number(l.toFixed(6)),
      deltaPct: Number(deltaPct.toFixed(3)),
      priceVsLongPct: Number(priceVsLongPct.toFixed(3)),
      closesUsed: closes.length,
      thresholdPct,
      scale,
    },
  };
}
