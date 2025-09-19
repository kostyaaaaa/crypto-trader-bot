// utils/logger.js
const connections = {};

export function logStream(symbol, stream) {
	if (!connections[symbol]) connections[symbol] = [];
	connections[symbol].push(stream);

	// коли зібрали всі 4 → виводимо одним рядком
	if (connections[symbol].length === 4) {
		console.log(`✅ Connected ${symbol}: ${connections[symbol].join(', ')}`);
	}
}