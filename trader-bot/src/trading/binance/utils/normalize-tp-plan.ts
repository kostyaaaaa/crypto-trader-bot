import type { TakeProfitPlanEntry } from '../../../types';
export function normalizeTpPlan(
  tps: Array<Partial<TakeProfitPlanEntry>> = [],
): TakeProfitPlanEntry[] {
  const plan = (tps || [])
    .map((tp) => ({
      price: Number(tp.price),
      sizePct: Number(tp.sizePct),
      pct: tp.pct != null ? Number(tp.pct) : undefined,
    }))
    .filter(
      (tp) =>
        Number.isFinite(tp.price) &&
        Number.isFinite(tp.sizePct) &&
        tp.sizePct > 0,
    );

  if (plan.length === 0) return [];

  const sum = plan.reduce((s, tp) => s + tp.sizePct, 0);

  if (sum === 100) return plan;

  if (sum < 100) {
    const last = plan[plan.length - 1];
    last.sizePct += 100 - sum;
    return plan;
  }

  // sum > 100 → масштабувати пропорційно
  return plan.map((tp) => ({ ...tp, sizePct: (tp.sizePct / sum) * 100 }));
}
