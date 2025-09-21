import pkg from 'binance-api-node';
const Binance = pkg.default;

export const client = Binance({
	apiKey: process.env.BINANCE_API_KEY,
	apiSecret: process.env.BINANCE_ACCOUNT_SECRET_KEY,
	futures: true,
});
// --- Баланс ---
export async function getFuturesBalance(asset = 'USDT') {
	const balances = await client.futuresAccountBalance();
	return balances.find(b => b.asset === asset)?.balance || 0;
}

// --- Відкрити ринковий ордер ---
export async function openMarketOrder(symbol, side, quantity) {
	return await client.futuresOrder({
		symbol,
		side,         // 'BUY' або 'SELL'
		type: 'MARKET',
		quantity,
	});
}

// --- Поставити стоп-лосс ---
export async function placeStopLoss(symbol, side, stopPrice, quantity) {
	return await client.futuresOrder({
		symbol,
		side: side === 'BUY' ? 'SELL' : 'BUY',
		type: 'STOP_MARKET',
		stopPrice,
		quantity,
	});
}

// --- Поставити тейк-профіт ---
export async function placeTakeProfit(symbol, side, tpPrice, quantity) {
	return await client.futuresOrder({
		symbol,
		side: side === 'BUY' ? 'SELL' : 'BUY',
		type: 'TAKE_PROFIT_MARKET',
		stopPrice: tpPrice,
		quantity,
	});
}

// --- Закрити позицію (ринком) ---
export async function closePosition(symbol, side, quantity) {
	return await client.futuresOrder({
		symbol,
		side: side === 'BUY' ? 'SELL' : 'BUY',
		type: 'MARKET',
		quantity,
		reduceOnly: true,
	});
}

// --- Отримати відкриті позиції ---
export async function getOpenPositions() {
	return await client.futuresPositionRisk();
}