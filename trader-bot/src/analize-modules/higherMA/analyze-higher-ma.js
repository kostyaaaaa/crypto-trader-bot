import axios from 'axios';
import { EMA as calcEMA, SMA } from '../../utils/getEMAAndRSI.js';

export async function analyzeHigherMA(
  symbol = 'ETHUSDT',
  cfg = {
    timeframe: '1d',
    maShort: 7,
    maLong: 14,
    type: 'SMA', // 'SMA' | 'EMA'
    thresholdPct: 0.2, // порог (в %) для отсечения шума по delta% между MA
    scale: 12, // strength = min(100, |delta%| * scale)
    emaSeed: 'sma', // 'sma' | 'first' — передаётся в EMA при наличии
  },
) {
  const timeframe = cfg.timeframe || '1d';
  const maShort = Number(cfg.maShort ?? 7);
  const maLong = Number(cfg.maLong ?? 14);
  const type = (cfg.type || 'SMA').toUpperCase();
  const thresholdPct = Number(cfg.thresholdPct ?? 0.2); // 0.2% по умолчанию
  const scale = Number.isFinite(cfg.scale) ? Number(cfg.scale) : 12;
  const emaSeed = cfg.emaSeed || 'sma';

  const limit = Math.max(maLong + 20, 200); // запас по барам
  const res = await axios.get('https://fapi.binance.com/fapi/v1/klines', {
    params: { symbol, interval: timeframe, limit },
  });

  const closes = res.data.map((k) => Number(k[4])).filter(Number.isFinite);
  if (closes.length < maLong) {
    return null;
  }

  const s =
    type === 'EMA'
      ? calcEMA(closes, maShort, { seed: emaSeed })
      : SMA(closes, maShort);
  const l =
    type === 'EMA'
      ? calcEMA(closes, maLong, { seed: emaSeed })
      : SMA(closes, maLong);
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

  // ціна підтримує сигнал (вище/нижче довгої MA)
  const agree =
    (signal === 'LONG' && priceVsLongPct >= 0) ||
    (signal === 'SHORT' && priceVsLongPct <= 0);

  // Нормалізована сила: 0..100 після проходження порогу
  // Починаємо рахувати лише за межами thresholdPct; до порогу сила = 0
  // Швидкість наростання контролюється "scale" через коефіцієнт rampK
  // (чим більший scale, тим швидше доходимо до 100)
  let strength = 0;
  let rampK = 3 * (12 / scale); // базово 3 для scale=12
  if (signal !== 'NEUTRAL') {
    const over = Math.max(0, Math.abs(deltaPct) - thresholdPct); // скільки % вище порогу
    const denom = thresholdPct * rampK || 1; // захист від ділення на 0
    strength = Math.min(100, (over / denom) * 100);
    if (!agree) strength *= 0.8; // легке демпфування, якщо ціна не підтримує сигнал
  }
  strength = Number(strength.toFixed(3));

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
      rampK,
      emaSeed,
    },
  };
}
