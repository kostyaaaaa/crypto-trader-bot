import { EMA, RSI } from './getEMAAndRSI.js';
import fs from 'fs';

export function analyzeCandles() {
  const candles = JSON.parse(fs.readFileSync('candles.json', 'utf-8'));

  if (candles.length < 21) {
    console.log(
      `⏳ Зібрано тільки ${candles.length} свічок, треба 21 для аналізу...`,
    );
    return null;
  }

  const closes = candles.map((c) => c.close);

  const emaFast = EMA(closes, 9);
  const emaSlow = EMA(closes, 21);
  const rsi = RSI(closes, 14);

  let trendLONG = 0,
    trendSHORT = 0;
  if (emaFast > emaSlow) trendLONG += 70;
  else trendSHORT += 70;
  if (rsi < 30) trendLONG += 30;
  if (rsi > 70) trendSHORT += 30;

  const result = { emaFast, emaSlow, rsi, trendLONG, trendSHORT };

  return result;
}
