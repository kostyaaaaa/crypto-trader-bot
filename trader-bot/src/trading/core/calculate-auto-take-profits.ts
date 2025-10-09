// trading/modules/autoTakeProfits.ts

export type Side = 'LONG' | 'SHORT';
export type VolRegime = 'DEAD' | 'EXTREME' | 'NORMAL' | string;

export interface AutoTPParams {
  entryPrice: number;
  side: Side; // 'LONG' | 'SHORT'
  atr?: number | null; // може бути null
  stopPrice?: number | null; // може бути null
  regime?: VolRegime; // 'DEAD' | 'EXTREME' | інше
}

export interface TakeProfitItem {
  price: number;
  sizePct: number; // 0..100
  // ⚠️ без `pct`: ми не зберігаємо його в БД, а при realign рахуємо за потреби
}

/**
 * Генерує TP-план:
 *  1) якщо є ATR → 2 рівні (50/50), мультиплікатори залежать від вола-режиму
 *  2) якщо ATR нема, але є stopPrice → RRR=2 (100%)
 *  3) fallback → фіксований 2% від ціни входу (100%)
 */
export function autoTakeProfits({
  entryPrice,
  side,
  atr = null,
  stopPrice = null,
  regime = 'NORMAL',
}: AutoTPParams): TakeProfitItem[] {
  const dir = side === 'LONG' ? 1 : -1;
  const tps: TakeProfitItem[] = [];

  // мультиплікатори за режимом волатильності
  let m1 = 1.2;
  let m2 = 2.0;
  if (regime === 'DEAD') {
    m1 = 0.8;
    m2 = 1.5;
  } else if (regime === 'EXTREME') {
    m1 = 2.0;
    m2 = 3.0;
  }

  // 1) ATR-базовані TP (2 рівні, 50/50)
  if (typeof atr === 'number' && Number.isFinite(atr) && atr > 0) {
    tps.push({ price: entryPrice + dir * atr * m1, sizePct: 50 });
    tps.push({ price: entryPrice + dir * atr * m2, sizePct: 50 });
    return tps;
  }

  // 2) Якщо ATR нема, але є стоп → RRR = 2 (100%)
  if (typeof stopPrice === 'number' && Number.isFinite(stopPrice)) {
    const risk = Math.abs(entryPrice - stopPrice);
    tps.push({ price: entryPrice + dir * risk * 2, sizePct: 100 });
    return tps;
  }

  // 3) Fallback → фіксований % (2%)
  tps.push({ price: entryPrice * (1 + dir * 0.02), sizePct: 100 });
  return tps;
}

export default autoTakeProfits;
