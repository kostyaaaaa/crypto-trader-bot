import axios from 'axios';
import { analyzeCandles } from '../analize-modules/candles/analyze-сandles.js';
import { analyzeCorrelation } from '../analize-modules/correlation/analyze-correlation.js';
import { analyzeFunding } from '../analize-modules/funding/analyze-funding.js';
import { analyzeLiquidations } from '../analize-modules/liquidations/analyze-liquidations.js';
import { analyzeLongShort } from '../analize-modules/longshort/analyze-longshort.js';
import { analyzeOpenInterest } from '../analize-modules/openinterest/analyze-openinterest.js';
import { analyzeLiquidity } from '../analize-modules/orderbook/analyze-liquidity.js';
import { analyzeTrendRegime } from '../analize-modules/trendRegime/analyze-trend-regime.js';
import { analyzeVolatility } from '../analize-modules/volatility/analyze-volatility.js';
import { saveDoc } from '../storage/storage.js';
const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  colors: {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    gray: '\x1b[90m',
    white: '\x1b[37m',
  },
};
export async function finalAnalyzer({
  symbol = 'ETHUSDT',
  analysisConfig = {},
} = {}) {
  const {
    candleTimeframe = '1m',
    oiWindow = 10,
    liqWindow = 20,
    liqSentWindow = 5,
    fundingWindow = 60,
    volWindow = 14,
    corrWindow = 5,
    longShortWindow = 5,
    weights = {},
    moduleThresholds = {},
  } = analysisConfig;
  const needed =
    Math.max(
      21,
      volWindow,
      corrWindow,
      oiWindow,
      fundingWindow,
      longShortWindow,
    ) + 5;
  // --- свічки напряму з Binance ---
  let klineRes;
  try {
    klineRes = await axios.get('https://fapi.binance.com/fapi/v1/klines', {
      params: { symbol, interval: candleTimeframe, limit: needed },
    });
  } catch (err) {
    if (err && err.code === 'ENOTFOUND') {
      console.warn(`⚠️ ${symbol} skipped (DNS error)`);
      return null;
    }
    throw err;
  }
  if (!klineRes) return null;
  const candles = klineRes.data.map((k) => ({
    time: new Date(k[0]).toISOString(),
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5]),
  }));
  const lastPrice = candles[candles.length - 1]?.close || null;

  // --- модулі ---
  const modules = {};
  modules.trend = await analyzeCandles(symbol, candles);
  modules.volatility = await analyzeVolatility(symbol, candles, volWindow);
  modules.trendRegime = await analyzeTrendRegime(symbol, candles, 14);

  modules.liquidity = await analyzeLiquidity(symbol, liqWindow, lastPrice);
  modules.funding = await analyzeFunding(symbol, fundingWindow);
  modules.liquidations = await analyzeLiquidations(symbol, liqSentWindow);
  modules.openInterest = await analyzeOpenInterest(symbol, oiWindow);
  modules.correlation = await analyzeCorrelation(symbol, corrWindow);
  modules.longShort = await analyzeLongShort(symbol, longShortWindow);

  // --- скоринг ---
  function weightedScore(side) {
    return Object.entries(modules).reduce((acc, [k, v]) => {
      if (!v) return acc;
      const value = v.meta?.[side] || 0;
      const threshold = moduleThresholds[k] || 0;
      if (value < threshold) return acc;
      return acc + value * (weights[k] || 0);
    }, 0);
  }

  const scoreLONG = weightedScore('LONG');
  const scoreSHORT = weightedScore('SHORT');

  let decision = 'NO TRADE';
  if (scoreLONG > 65) decision = 'STRONG LONG';
  else if (scoreLONG > 50) decision = 'WEAK LONG';
  else if (scoreSHORT > 65) decision = 'STRONG SHORT';
  else if (scoreSHORT > 50) decision = 'WEAK SHORT';

  const bias =
    scoreLONG > scoreSHORT
      ? 'LONG'
      : scoreSHORT > scoreLONG
        ? 'SHORT'
        : 'NEUTRAL';

  const filledModules = Object.values(modules).filter(
    (m) => m && (m.meta?.LONG ?? 0) + (m.meta?.SHORT ?? 0) > 0,
  ).length;
  const fmt = (n, d = 2) => (Number.isFinite(n) ? Number(n).toFixed(d) : '-');

  const scoreboardRows = Object.entries(modules).map(([key, mod]) => {
    if (!mod) {
      return {
        Module: key,
        Signal: 'NO DATA',
        Strength: '-',
        LONG: 0,
        SHORT: 0,
        Weight: Number(weights[key] ?? 0),
        Threshold: Number(moduleThresholds[key] ?? 0),
        PassLONG: false,
        PassSHORT: false,
        ContribLONG: 0,
        ContribSHORT: 0,
      };
    }
    const weight = Number(weights[key] ?? 0);
    const threshold = Number(moduleThresholds[key] ?? 0);
    const LONG = Number(mod.meta?.LONG ?? 0);
    const SHORT = Number(mod.meta?.SHORT ?? 0);
    const passLONG = LONG >= threshold;
    const passSHORT = SHORT >= threshold;
    const contribLONG = passLONG ? Number((LONG * weight).toFixed(2)) : 0;
    const contribSHORT = passSHORT ? Number((SHORT * weight).toFixed(2)) : 0;

    return {
      Module: key,
      Signal: mod.signal ?? 'NEUTRAL',
      Strength: Number(mod.strength ?? 0),
      LONG,
      SHORT,
      Weight: weight,
      Threshold: threshold,
      PassLONG: passLONG,
      PassSHORT: passSHORT,
      ContribLONG: contribLONG,
      ContribSHORT: contribSHORT,
    };
  });

  // — console.table scoreboard (clean) —
  const fmt3 = (n) => (Number.isFinite(n) ? Number(n).toFixed(3) : '-');

  // prepare compact rows without Pass/Contrib and without ANSI
  const compactRows = scoreboardRows.map((r) => ({
    Module: r.Module,
    Signal: r.Signal, // plain text: LONG/SHORT/NEUTRAL
    Strength: fmt3(r.Strength),
    LONG: fmt3(r.LONG),
    SHORT: fmt3(r.SHORT),
    W: Number(r.Weight).toFixed(2),
    Th: Number(r.Threshold).toFixed(0),
  }));

  // Use an object keyed by Module so Module is shown as the row label instead of extra index column
  const tableObj = {};
  for (const row of compactRows) {
    const { Module, ...rest } = row;
    tableObj[Module] = rest;
  }

  console.log(
    '\n' +
      ANSI.bold +
      `MODULE SCOREBOARD — ${symbol} [${candleTimeframe}]` +
      ANSI.reset,
  );
  console.table(tableObj); // clean console.table without redundant index & without ANSI escape codes in cells
  console.log(
    `${ANSI.bold}TOTALS:${ANSI.reset} LONG ${fmt(scoreLONG, 3)} | SHORT ${fmt(scoreSHORT, 3)} | ` +
      `${ANSI.bold}BIAS:${ANSI.reset} ${bias} | ${ANSI.bold}DECISION:${ANSI.reset} ${decision}\n`,
  );

  const result = {
    time: new Date(),
    symbol,
    timeframe: candleTimeframe,
    modules,
    scores: {
      LONG: Number(scoreLONG.toFixed(1)),
      SHORT: Number(scoreSHORT.toFixed(1)),
    },
    coverage: `${filledModules}/${Object.keys(modules).length}`,
    bias,
    decision,
  };
  await saveDoc('analysis', result);
  return result;
}
