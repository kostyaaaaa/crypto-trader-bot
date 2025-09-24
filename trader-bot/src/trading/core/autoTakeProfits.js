// trading/modules/autoTakeProfits.js
export function autoTakeProfits({
									entryPrice,
									side,                 // 'LONG' | 'SHORT'
									atr = null,           // число або null
									stopPrice = null,     // число або null
									regime = 'NORMAL',    // 'DEAD' | 'EXTREME' | інше
								}) {
	const dir = side === 'LONG' ? 1 : -1;
	const tps = [];

	// мультиплікатори за режимом волатильності
	let m1 = 1.2, m2 = 2.0;
	if (regime === 'DEAD')    { m1 = 0.8; m2 = 1.5; }
	if (regime === 'EXTREME') { m1 = 2.0; m2 = 3.0; }

	// 1) ATR-базовані TP (2 рівні, 50/50)
	if (Number.isFinite(atr) && atr > 0) {
		tps.push({ price: entryPrice + dir * atr * m1, sizePct: 50 });
		tps.push({ price: entryPrice + dir * atr * m2, sizePct: 50 });
		return tps;
	}

	// 2) Якщо ATR нема, але є стоп → RRR = 2 (100%)
	if (Number.isFinite(stopPrice)) {
		const risk = Math.abs(entryPrice - stopPrice);
		tps.push({ price: entryPrice + dir * risk * 2, sizePct: 100 });
		return tps;
	}

	// 3) Fallback → фіксований % (2%)
	tps.push({ price: entryPrice * (1 + dir * 0.02), sizePct: 100 });
	return tps;
}