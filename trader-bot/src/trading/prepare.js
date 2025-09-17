// trading/prepare.js
import { getLastPrice } from "../utils/getLastPrice.js"; // функція, яка читає останній price із candles/ticker

export async function preparePosition(symbol, cfg, analysis, side) {
	const { capital, sizing, exits } = cfg.strategy;
	const entryPrice = await getLastPrice(symbol);
	// --- 1. Базові розрахунки ---
	const leverage = capital.leverage || 1;
	const baseSize = sizing.baseSizeUsd;
	const maxSize = sizing.maxPositionUsd;
	const size = Math.min(baseSize, maxSize); // перший вхід
	// --- 2. Risk у USD ---
	const riskPerTradeUsd = (capital.account * capital.riskPerTradePct) / 100;

	// --- 3. Стоп-лосс ---
	let stopPrice = null;
	if (exits.sl.type === "hard") {
		const movePct = exits.sl.hardPct / 100; // наприклад 1.2% → 0.012
		stopPrice =
			side === "LONG"
				? entryPrice * (1 - movePct)
				: entryPrice * (1 + movePct);
	}

	// --- 4. Тейк-профіти (грид)
	const takeProfits = [];
	if (exits.tp.use) {
		exits.tp.tpGridPct.forEach((pct, i) => {
			const move = pct / 100;
			const tpPrice =
				side === "LONG"
					? entryPrice * (1 + move)
					: entryPrice * (1 - move);

			takeProfits.push({
				price: tpPrice,
				sizePct: exits.tp.tpGridSizePct[i], // скільки % позиції закриваємо
			});
		});
	}

	// --- 5. Формуємо об’єкт позиції ---
	return {
		id: `${symbol}_${Date.now()}`,
		symbol,
		side, // LONG / SHORT
		size,
		leverage,
		openedAt: new Date().toISOString(),
		status: "OPEN",
		entryPrice,
		stopPrice,
		takeProfits,
		riskUsd: riskPerTradeUsd,
		analysisRefs: [analysis.time], // для відстеження, по якому аналізу увійшли
	};
}