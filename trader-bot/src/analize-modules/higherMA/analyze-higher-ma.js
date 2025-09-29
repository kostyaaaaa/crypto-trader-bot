// Пояснення параметрів

// 1) timeframe (string)
// 	•	Що це: з якого ТФ брати свічки для «вищого фону» (HTF).
// 	•	Варіанти: будь-який інтервал Binance ('1d', '4h', '1w', …).
// 	•	Рекомендації:
// 	•	Скальп 1–5m → фон 1d або 4h.
// 	•	Інтрадей 15m–1h → фон 4h/1d.
// 	•	Свінг 4h–1d → фон 1w.
// 	•	Вплив: визначає «повільність»/стабільність фону. Чим старший ТФ, тим рідше змінюється сигнал і менше шуму.

// 2) maShort (number) та maLong (number)
// 	•	Що це: довжини короткої та довгої ковзної середньої.
// 	•	Типові пари: 7/14, 9/21, 10/20.
// 	•	Правило: maShort < maLong.
// 	•	Вплив: менша пара → швидше реагує; більша пара → спокійніше, чистіше.
// 	•	Порада: для HTF-фону 7/14 або 9/21 — оптимально просто.

// 3) type (‘SMA’ | ‘EMA’)
// 	•	Що це: тип ковзної середньої.
// 	•	SMA: проста середня (рівні ваги), повільніша, чистіша.
// 	•	EMA: експоненційна (більша вага останнім барам), швидша, чутливіша.
// 	•	Коли яку:
// 	•	Хочеш консервативний фон → SMA.
// 	•	Хочеш чутливий фон (раніше ловить розвороти) → EMA.

// 4) thresholdPct (number, %)
// 	•	Що це: мінімальна відносна різниця між MA (у % від ціни), щоб вважати, що є трендовий сигнал, а не шум.
// 	•	Логіка: обчислюємо deltaPct = (MAshort - MAlong) / price * 100.
// Якщо |deltaPct| < thresholdPct → signal = 'NEUTRAL'.
// 	•	Типові значення:
// 	•	0.1–0.3% для денного фону на BTC/ETH,
// 	•	0.2–0.4% для більш «смикливих» альтів,
// 	•	для 4h фонів — можна зменшити на ~25%.
// 	•	Вплив: більший поріг → менше хибних спрацювань, але пізніше входить у тренд.

// 5) scale (number)
// 	•	Що це: лінійний множник для сили сигналу.
// Формула: strength = Math.min(100, Math.abs(deltaPct) * scale).
// 	•	Приклад: deltaPct = 2%, scale = 20 → strength = 40.
// 	•	Діапазон: зазвичай 15–30. Більше scale → швидше росте сила при тій самій різниці MA.
// 	•	Вплив: контролює, наскільки «вагомим» стане цей модуль у скорингу при заданій різниці MA.

// 6) emaSeed (‘sma’ | ‘first’) — лише для type: 'EMA'
// 	•	Що це: спосіб ініціалізації EMA.
// 	•	‘sma’: перше значення EMA = SMA перших period значень (класика, стабільніше).
// 	•	‘first’: перше значення EMA = перша ціна (швидший старт, трохи більш «нервово» на коротких рядах).
// 	•	Рекомендація: залишай 'sma', якщо немає конкретних причин пришвидшувати реакцію EMA.

// Якщо type: 'SMA', параметр emaSeed ігнорується.

// ⸻

// Як модуль приймає рішення
// 	1.	Рахує MAshort, MAlong, price.
// 	2.	delta = MAshort - MAlong, deltaPct = (delta / price) * 100.
// 	3.	Якщо |deltaPct| < thresholdPct → signal = 'NEUTRAL', strength = 0.
// 	4.	Інакше:
// 	•	signal = 'LONG', якщо delta > 0; signal = 'SHORT', якщо delta < 0.
// 	•	strength = min(100, |deltaPct| * scale).
// 	•	Якщо ціна не погоджується із напрямком (наприклад, LONG, але price < MAlong) — сила × 0.6 (легке демпфування).
// 	5.	У meta повертається тільки одна сторона:
// LONG = strength, SHORT = 0 для LONG-сигналу; навпаки — для SHORT; нейтраль — 0/0.

// ⸻

// Готові пресети (скопіпасти)

// 1) Консервативний денний фон (BTC/ETH)
// higherMA: {
//   timeframe: '1d',
//   maShort: 7,
//   maLong: 14,
//   type: 'SMA',
//   thresholdPct: 0.2,
//   scale: 12, // strength = min(100, |delta%| * scale)
//   emaSeed: 'sma'
// }
// 2) Чутливий денний фон (EMA)
// higherMA: {
//   timeframe: '1d',
//   maShort: 7,
//   maLong: 14,
//   type: 'EMA',
//   thresholdPct: 0.2,  // можна 0.15, якщо хочеш ще чутливіше
//   scale: 12, // strength = min(100, |delta%| * scale)
//   emaSeed: 'sma'      // або 'first', якщо потрібен швидкий старт
// }
// 3) Фон для інтрадею (4h)
// higherMA: {
//   timeframe: '4h',
//   maShort: 9,
//   maLong: 21,
//   type: 'SMA',
//   thresholdPct: 0.15, // трошки нижче, ніж на 1d
//   scale: 22,
//   emaSeed: 'sma'
// }
// 4) Макро-фон (тижневий)
// higherMA: {
//   timeframe: '1w',
//   maShort: 7,
//   maLong: 14,
//   type: 'SMA',
//   thresholdPct: 0.25,
//   scale: 18,
//   emaSeed: 'sma'
// }
// Як це стикується зі скорингом
// 	•	У finalAnalyzer цей модуль додає бали лише в сторону сигналу (друга сторона = 0).
// 	•	Щоб він працював як фоновий фільтр, а не «домінант», став помірну вагу і невеликий поріг:
//   weights: { higherMA: 0.05 - 0.10 },
// moduleThresholds: { higherMA: 5 - 10 }

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
      emaSeed,
    },
  };
}
