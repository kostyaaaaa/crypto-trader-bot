// analyze-correlation.js
// --- Аналізує кореляцію з BTC ---
// Якщо торгуємо alt (ETH, SOL, ADA…), а BTC сильно рухається → враховуємо цей сигнал
// Працює через групи кореляції (strong, medium, weak), які ми задаємо в correlation-config.js

import { correlationGroups } from "../../constants/correlation-config.js";
import { loadDocs } from "../../storage/storage.js";

// Визначаємо групу (наскільки сильно символ корелює з BTC)
function getGroup(symbol) {
	symbol = symbol.toUpperCase();
	if (correlationGroups.strong.includes(symbol)) return "strong";
	if (correlationGroups.medium.includes(symbol)) return "medium";
	if (correlationGroups.weak.includes(symbol)) return "weak";
	return null;
}

export async function analyzeCorrelation(symbol, window = 5) {
	const group = getGroup(symbol);
	if (!group) {
		return { symbol, signal: "NONE", LONG: 50, SHORT: 50, data: { group: "none" } };
	}

	// читаємо історію BTC
	const btc = await loadDocs("btc",  "BTCUSDT", window );
	if (!btc || btc.length < window) {
		console.log(`⚠️ Only ${btc?.length || 0} BTC candles, need ${window}`);
		return null;
	}

	const recent = btc.slice(-window);
	const first = recent[0];
	const last = recent[recent.length - 1];

	// зміна BTC (%)
	const btcChangePct = ((last.close - first.close) / first.close) * 100;

	// базовий сигнал: BTC > +0.5% → LONG, < −0.5% → SHORT
	let signal = "NONE";
	let LONG = 50;
	let SHORT = 50;

	if (btcChangePct > 0.5) {
		signal = "LONG";
		LONG = 50 + Math.min(Math.abs(btcChangePct) * 5, 50); // масштабуємо зміну
		SHORT = 100 - LONG;
	} else if (btcChangePct < -0.5) {
		signal = "SHORT";
		SHORT = 50 + Math.min(Math.abs(btcChangePct) * 5, 50);
		LONG = 100 - SHORT;
	}

	// коефіцієнт впливу від групи
	const weights = { strong: 1.0, medium: 0.6, weak: 0.3 };

	return {
		symbol,
		signal, // LONG / SHORT / NONE
		LONG: Math.round(LONG * weights[group]),
		SHORT: Math.round(SHORT * weights[group]),
		data: {
			candlesUsed: recent.length,
			btcChangePct: btcChangePct.toFixed(2),
			group,
			weight: weights[group],
		},
	};
}