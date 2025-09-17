// trading/risk.js
export function calculatePositionSize({ account, riskPerTradePct, leverage, baseSizeUsd, maxPositionUsd }) {
	const riskBudget = (account * riskPerTradePct) / 100; // стоп-бюджет
	const baseSize = Math.min(baseSizeUsd, riskBudget * leverage);
	return Math.min(baseSize, maxPositionUsd);
}