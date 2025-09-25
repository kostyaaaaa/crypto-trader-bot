// utils/timeframes.js
export function getHigherTF(tf) {
  const map = {
    '1m': '15m',
    '5m': '1h',
    '15m': '4h',
    '1h': '4h',
    '4h': '1d',
    '1d': '1w',
  };
  return map[tf] || null;
}
