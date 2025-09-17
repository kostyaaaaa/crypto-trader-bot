// trading/engine.js
import { loadDocs } from "../storage/storage.js";
import { calculatePositionSize } from "./risk.js";
import { addPosition } from "./positions.js";
import { preparePosition } from "./prepare.js";

export async function tradingEngine(symbol, config) {
	const lookback = 3;
	const analysisHistory = await loadDocs("analysis", symbol, lookback);

	if (!analysisHistory || analysisHistory.length < lookback) {
		console.log(`⚠️ Not enough analysis history for ${symbol}`);
		return;
	}

	// 1. Беремо останні аналізи
	const lastAnalyses = analysisHistory.reverse(); // від старих до нових
	const decisions = lastAnalyses.map((a) => a.bias);

	// 2. Визначаємо більшість (LONG / SHORT)
	const majority = decisions
		.sort(
			(a, b) =>
				decisions.filter((v) => v === a).length -
				decisions.filter((v) => v === b).length
		)
		.pop();

	if (majority === "NEUTRAL") return;

	// 3. Беремо останній аналіз для сконфірмування
	const analysis = lastAnalyses[lastAnalyses.length - 1];
	const { entry, capital } = config.strategy;
	const { scores } = analysis;

	const minScore = entry.minScore[majority];
	// if (scores[majority] < minScore) return;

	// 4. Розрахунок розміру угоди
	const size = calculatePositionSize({
		...capital,
		baseSizeUsd: config.strategy.sizing.baseSizeUsd,
		maxPositionUsd: config.strategy.sizing.maxPositionUsd,
	});
	// 5. Готуємо повну позицію через preparePosition
	const position = await preparePosition(symbol, config, analysis, majority, size);

	await addPosition(position);
	console.log("🟢 New position opened:", position);
}