import fs from 'fs';

export function analyzeLiquidity() {
  let liquidity = [];
  try {
    liquidity = JSON.parse(fs.readFileSync('liquidity.json', 'utf-8'));
  } catch (e) {
    console.log('❌ No liquidity data found');
    return null;
  }

  if (liquidity.length < 20) {
    console.log('⚠️ Not enough liquidity candles for analysis');
    return null;
  }

  const recent = liquidity.slice(-20);

  const avgImbalance =
    recent.reduce((s, c) => s + parseFloat(c.avgImbalance), 0) / recent.length;
  const avgSpread =
    recent.reduce((s, c) => s + parseFloat(c.avgSpread), 0) / recent.length;

  let decision = 'NEUTRAL';
  if (avgImbalance > 0.55) decision = 'LONG';
  else if (avgImbalance < 0.45) decision = 'SHORT';

  const result = {
    candlesUsed: recent.length,
    avgImbalance: avgImbalance.toFixed(3),
    avgSpread: avgSpread.toFixed(2),
    decision,
  };

  console.log('📊 Liquidity analysis:', result);
  return result;
}
