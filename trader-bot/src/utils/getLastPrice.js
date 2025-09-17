// utils/price.js
import { loadDocs } from "../storage/storage.js";

export async function getLastPrice(symbol) {
	// забираємо останню свічку
	const candles = await loadDocs("candles", symbol, 1);

	if (!candles || !candles.length) {
		console.log(`⚠️ No candles found for ${symbol}`);
		return null;
	}

	const last = candles[candles.length - 1];

	return last.close;
}