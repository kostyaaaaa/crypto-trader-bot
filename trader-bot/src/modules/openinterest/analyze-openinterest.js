// analyze-open-interest.js
// --- OI + Price: перетворюємо на LONG/SHORT % ---
// Матриця напрямку:
//  • OI↑ + Price↑ → LONG
//  • OI↑ + Price↓ → SHORT
//  • OI↓ + Price↑ → SHORT (fake move)
//  • OI↓ + Price↓ → LONG (short covering)

import { loadDocs } from "../../storage/storage.js";

export async function analyzeOpenInterest(symbol = "ETHUSDT", window = 5) {
	const oi = await loadDocs("openinterest",  symbol,window );
	if (!oi || oi.length < window) {
		console.log(`⚠️ Not enough OI data for ${symbol}, need ${window}`);
		return null;
	}

	const recent = oi.slice(-window);
	const first = recent[0];
	const last = recent[recent.length - 1];

	// захист від ділення на 0
	const safePct = (end, start) =>
		(start && isFinite(start)) ? ((end - start) / start) * 100 : 0;

	const oiChangePct = safePct(last.openInterest, first.openInterest);
	const oiValueChangePct = safePct(last.openInterestValue, first.openInterestValue);
	const priceChangePct = safePct(last.price, first.price);

	// Напрямок (SIGN): +1 → LONG, -1 → SHORT
	// (узгоджений з нашою матрицею вище)
	const sameDirection = (oiChangePct >= 0 && priceChangePct >= 0) ||
		(oiChangePct < 0 && priceChangePct < 0);
	const sign = sameDirection ? +1 : -1;

	// Комбінована "сила" руху: OI важче (0.6), ціна (0.4)
	const mag = 0.6 * Math.abs(oiChangePct) + 0.4 * Math.abs(priceChangePct);

	// Дуже малий рух → 50/50
	if (mag < 0.05) {
		return wrapResult({
			symbol,
			oiChangePct,
			oiValueChangePct,
			priceChangePct,
			longPct: 50,
			shortPct: 50,
			signal: "NONE",
			candlesUsed: recent.length,
			first, last,
		});
	}

	// Плавне перетворення у ймовірність через логістичну функцію
	// k — крутість (0.35 дає адекватну чутливість для % діапазону 0–5+)
	const k = 0.35;
	const pLong = 1 / (1 + Math.exp(-k * sign * mag)); // 0..1
	let longPct = Math.round(pLong * 100);
	let shortPct = 100 - longPct;

	// Сигнал за перевагою
	let signal = "LONG";
	if (shortPct > longPct) signal = "SHORT";
	if (Math.abs(longPct - shortPct) < 5) signal = "NONE"; // дуже близько → без явного сигналу

	return wrapResult({
		symbol,
		oiChangePct,
		oiValueChangePct,
		priceChangePct,
		longPct,
		shortPct,
		signal,
		candlesUsed: recent.length,
		first, last,
	});
}

/* ---------- helpers ---------- */

function wrapResult({
						symbol,
						oiChangePct,
						oiValueChangePct,
						priceChangePct,
						longPct,
						shortPct,
						signal,
						candlesUsed,
						first,
						last,
					}) {
	return {
		symbol,
		signal,             // "LONG" | "SHORT" | "NONE"
		LONG: longPct,      // 0..100
		SHORT: shortPct,    // 0..100
		data: {
			candlesUsed,
			startOI: first.openInterest,
			endOI: last.openInterest,
			oiChangePct: to2(oiChangePct),
			startOIValue: first.openInterestValue,
			endOIValue: last.openInterestValue,
			oiValueChangePct: to2(oiValueChangePct),
			startPrice: first.price,
			endPrice: last.price,
			priceChangePct: to2(priceChangePct),
		},
	};
}

const to2 = (x) => Number.isFinite(x) ? x.toFixed(2) : "0.00";