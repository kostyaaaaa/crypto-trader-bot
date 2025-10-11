type Side = 'LONG' | 'SHORT';
type Bias = Side | 'NEUTRAL';

/**
 * Strict majority voting: returns winner only if count > floor(n/2), otherwise NEUTRAL
 * Tie-break: last occurrence wins
 *
 * @param list - Array of bias values to vote on
 * @returns The winning bias or NEUTRAL
 */
export function majorityVoteStrict(list: Bias[]): Bias {
  if (!Array.isArray(list) || list.length === 0) return 'NEUTRAL';

  const counts = list.reduce<Record<string, number>>((acc, v) => {
    acc[v] = (acc[v] || 0) + 1;
    return acc;
  }, {});

  let best: Bias = 'NEUTRAL';
  let bestCount = 0;

  for (const [k, c] of Object.entries(counts)) {
    if (c > bestCount) {
      best = k as Bias;
      bestCount = c;
    } else if (c === bestCount) {
      if (list.lastIndexOf(k as Bias) > list.lastIndexOf(best))
        best = k as Bias;
    }
  }

  return bestCount > Math.floor(list.length / 2) ? best : 'NEUTRAL';
}
