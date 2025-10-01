// analize-modules/customMA/analyze-custom-ma.js
// Кастомні MA-правила: [<tf>: <expr> = <side><points>]
// Приклади:
// [4h:ma99>ma25>ma7=short40]
// [15min:ma99>ma25>ma7>currentPrice=short90]
// За замовчуванням maN = EMA(N). Можна писати явно: smaN / emaN.
// 'currentPrice' | 'price' | 'close' — остання ціна закриття.

import axios from 'axios';

const TF_SYNONYMS = new Map([
  ['1min', '1m'],
  ['3min', '3m'],
  ['5min', '5m'],
  ['15min', '15m'],
  ['30min', '30m'],
  ['1h', '1h'],
  ['2h', '2h'],
  ['4h', '4h'],
  ['6h', '6h'],
  ['8h', '8h'],
  ['12h', '12h'],
  ['1d', '1d'],
  ['1day', '1d'],
  ['daily', '1d'],
]);

const TF_OK = new Set([
  '1m',
  '3m',
  '5m',
  '15m',
  '30m',
  '1h',
  '2h',
  '4h',
  '6h',
  '8h',
  '12h',
  '1d',
]);

function normalizeTF(tfRaw) {
  const tf = String(tfRaw || '').toLowerCase();
  if (TF_SYNONYMS.has(tf)) return TF_SYNONYMS.get(tf);
  return TF_OK.has(tf) ? tf : null;
}

function SMA(values, p) {
  if (!Array.isArray(values) || values.length < p) return null;
  const sum = values.slice(-p).reduce((s, v) => s + v, 0);
  return sum / p;
}

// EMA із seed через SMA — стабільніше для великих періодів
function EMA(values, p) {
  if (!Array.isArray(values) || values.length < p) return null;
  const k = 2 / (p + 1);
  let ema = SMA(values.slice(0, p), p);
  for (let i = p; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k);
  }
  return ema;
}

// [tf: expr = sidePoints]
function parseRule(raw, defaultMAType = 'EMA') {
  if (!raw) return null;
  const s = String(raw)
    .trim()
    .replace(/^\[|\]$/g, '')
    .replace(/\s+/g, '');
  // приклад матчу: 4h:ma99>ma25>ma7>currentPrice=short40
  const m = s.match(/^([a-z0-9]+):(.+?)=(long|short)(\d{1,3})$/i);
  if (!m) return null;

  const [, tfRaw, expr, sideRaw, ptsRaw] = m;
  const tf = normalizeTF(tfRaw);
  if (!tf) return null;

  const side = sideRaw.toUpperCase(); // LONG | SHORT
  const points = Math.max(0, Math.min(100, Number(ptsRaw)));

  const terms = expr.split('>').map((t) => {
    const tLow = t.toLowerCase();
    if (tLow === 'price' || tLow === 'close' || tLow === 'currentprice') {
      return { kind: 'PRICE' };
    }
    const ema = tLow.match(/^ema(\d{1,4})$/);
    const sma = tLow.match(/^sma(\d{1,4})$/);
    const ma = tLow.match(/^ma(\d{1,4})$/);
    if (ema) return { kind: 'EMA', period: Number(ema[1]) };
    if (sma) return { kind: 'SMA', period: Number(sma[1]) };
    if (ma)
      return {
        kind: (defaultMAType || 'EMA').toUpperCase(),
        period: Number(ma[1]),
      };
    return null;
  });

  if (terms.some((x) => !x)) return null;
  return { tf, terms, side, points, raw };
}

function needLimit(periods) {
  const maxP = Math.max(...periods, 1);
  return Math.min(1000, Math.max(maxP + 60, 180)); // запас під розгін EMA
}

export async function analyzeCustomMA(symbol = 'ETHUSDT', analysisConfig) {
  const tag = `[customMA:${symbol}:${Date.now() % 1e6}]`;
  console.log(tag, 'analysisConfig =', JSON.stringify(analysisConfig));
  console.log(
    tag,
    'analysisConfig.customMA =',
    JSON.stringify(analysisConfig?.customMA),
  );

  const { rules: rawRules, defaultMAType } = analysisConfig.customMA;
  const rules = (rawRules || [])
    .map((r) => parseRule(r, defaultMAType))
    .filter(Boolean);

  console.log('analyzeCustomMA received:', {
    defaultMAType,
    rulesCount: rules.length,
  });

  if (!rules.length) return null;

  // 1) Групуємо правила по TF і збираємо потрібні періоди
  const tfMap = new Map(); // tf -> { periods:Set, rules:[] }
  for (const r of rules) {
    let entry = tfMap.get(r.tf);
    if (!entry) {
      entry = { periods: new Set(), rules: [] };
      tfMap.set(r.tf, entry);
    }
    for (const t of r.terms) if (t.period) entry.periods.add(t.period);
    entry.rules.push(r);
  }

  // 2) Тягнемо клози для кожного TF один раз
  const tfData = new Map(); // tf -> { closes, lastPrice, maCache }
  for (const [tf, info] of tfMap.entries()) {
    const limit = needLimit([...info.periods]);
    const res = await axios.get('https://fapi.binance.com/fapi/v1/klines', {
      params: { symbol, interval: tf, limit },
    });
    const closes = res.data.map((k) => Number(k[4])).filter(Number.isFinite);
    if (!closes.length) continue;
    tfData.set(tf, {
      closes,
      lastPrice: closes[closes.length - 1],
      maCache: new Map(),
    });
  }
  if (!tfData.size) return null;

  // 3) Хелпер для термів
  const getTermValue = (tfEntry, term) => {
    if (term.kind === 'PRICE') return tfEntry.lastPrice;
    const key = `${term.kind}:${term.period}`;
    if (tfEntry.maCache.has(key)) return tfEntry.maCache.get(key);
    const v =
      term.kind === 'EMA'
        ? EMA(tfEntry.closes, term.period)
        : SMA(tfEntry.closes, term.period);
    tfEntry.maCache.set(key, v);
    return v;
  };

  // 4) Оцінка правил
  let LONG = 0,
    SHORT = 0;
  const evaluations = [];

  for (const [tf, info] of tfMap.entries()) {
    const tfEntry = tfData.get(tf);
    if (!tfEntry) {
      for (const r of info.rules) {
        evaluations.push({
          tf,
          rule: r.raw,
          side: r.side,
          points: r.points,
          passed: false,
          reason: 'no-data',
        });
      }
      continue;
    }

    for (const r of info.rules) {
      let ok = true;
      let failedAt = -1;
      for (let i = 0; i < r.terms.length - 1; i++) {
        const a = getTermValue(tfEntry, r.terms[i]);
        const b = getTermValue(tfEntry, r.terms[i + 1]);
        if (!Number.isFinite(a) || !Number.isFinite(b) || !(a > b)) {
          ok = false;
          failedAt = i;
          break;
        }
      }
      if (ok) {
        if (r.side === 'LONG') LONG += r.points;
        else SHORT += r.points;
        evaluations.push({
          tf,
          rule: r.raw,
          side: r.side,
          points: r.points,
          passed: true,
        });
      } else {
        evaluations.push({
          tf,
          rule: r.raw,
          side: r.side,
          points: r.points,
          passed: false,
          failedAt,
        });
      }
    }
  }

  // 5) Клемп 0..100 для модульних мета-балів
  LONG = Math.max(0, Math.min(100, LONG));
  SHORT = Math.max(0, Math.min(100, SHORT));

  const strength = Math.max(LONG, SHORT);
  const signal = LONG > SHORT ? 'LONG' : SHORT > LONG ? 'SHORT' : 'NEUTRAL';

  return {
    module: 'customMA',
    symbol,
    signal,
    strength,
    meta: {
      LONG,
      SHORT,
      rulesCount: rules.length,
      evaluations,
      defaultMAType: (defaultMAType || 'EMA').toUpperCase(),
    },
  };
}
