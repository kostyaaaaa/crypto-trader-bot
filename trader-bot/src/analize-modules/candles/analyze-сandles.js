import { EMA, RSI } from '../../utils/getEMAAndRSI.js';

export async function analyzeCandles(symbol = 'ETHUSDT', candles = []) {
  if (!candles || candles.length < 21) {
    console.log(
      `⏳ Only ${candles?.length || 0} candles for ${symbol}, need ≥21...`,
    );
    return null;
  }

  const closes = candles.map((c) => c.close);

  const emaFast = EMA(closes, 9, { seed: 'sma' });
  const emaSlow = EMA(closes, 21, { seed: 'sma' });
  const emaGapPct = ((emaFast - emaSlow) / emaSlow) * 100;

  const rsi = RSI(closes, 14);

  let longScore = 50;
  let shortScore = 50;

  if (emaGapPct > 0) {
    longScore += Math.min(30, Math.abs(emaGapPct) * 5);
    shortScore -= Math.min(30, Math.abs(emaGapPct) * 5);
  } else {
    shortScore += Math.min(30, Math.abs(emaGapPct) * 5);
    longScore -= Math.min(30, Math.abs(emaGapPct) * 5);
  }

  if (rsi < 30) {
    longScore += 20;
    shortScore -= 20;
  } else if (rsi > 70) {
    shortScore += 20;
    longScore -= 20;
  }

  longScore = Math.max(0, Math.min(100, longScore));
  shortScore = Math.max(0, Math.min(100, shortScore));

  let signal = 'NEUTRAL';
  if (longScore > shortScore) signal = 'LONG';
  else if (shortScore > longScore) signal = 'SHORT';

  return {
    module: 'trend',
    symbol,
    signal,
    strength: Math.max(longScore, shortScore),
    meta: {
      LONG: longScore,
      SHORT: shortScore,
      emaFast: parseFloat(emaFast.toFixed(2)),
      emaSlow: parseFloat(emaSlow.toFixed(2)),
      emaGapPct: parseFloat(emaGapPct.toFixed(2)),
      rsi: parseFloat(rsi.toFixed(2)),
    },
  };
}
