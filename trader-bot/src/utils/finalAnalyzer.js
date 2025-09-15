import fs from 'fs';
import { analyzeCandles } from "./analyze-сandles.js";
import { getSentimentBlock } from "./getSentimentBlockValue.js";
import { analyzeLiquidity } from "./analyze-liquidity.js";

export function finalAnalyzer() {
	// --- Trend block ---
	const { trendLONG = 0, trendSHORT = 0 } = analyzeCandles() || {};

	// --- Liquidity block ---
	let liqLONG = 0, liqSHORT = 0;
	try {
		const liquidityData = JSON.parse(fs.readFileSync('liquidity.json', 'utf-8'));
		const liq = analyzeLiquidity(liquidityData, 20); // беремо останні 20 хвилин
		if (liq.signal === 'LONG') liqLONG = 100;
		if (liq.signal === 'SHORT') liqSHORT = 100;
	} catch (e) {
		console.log("⚠️ No liquidity data yet");
	}

	// --- Sentiment block ---
	const candles = JSON.parse(fs.readFileSync('candles.json', 'utf-8'));
	const lastCandle = candles[candles.length - 1];
	const { sentLONG, sentSHORT } = getSentimentBlock(lastCandle);

	// --- Weighted scoring ---
	function weightedScore(trend, liq, sent) {
		return (trend * 0.5) + (liq * 0.3) + (sent * 0.2);
	}

	const scoreLONG = weightedScore(trendLONG, liqLONG, sentLONG);
	const scoreSHORT = weightedScore(trendSHORT, liqSHORT, sentSHORT);

	let decision = "NO TRADE";
	if (scoreLONG > 65) decision = "LONG";
	if (scoreSHORT > 65) decision = "SHORT";

	console.log({
		trendLONG,
		trendSHORT,
		liqLONG,
		liqSHORT,
		sentLONG,
		sentSHORT,
		scoreLONG,
		scoreSHORT,
		decision
	});

	return { scoreLONG, scoreSHORT, decision };
}