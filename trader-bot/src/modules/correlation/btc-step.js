// btc-step.js
// --- WebSocket для збору 1-хвилинних свічок BTCUSDT ---
// Дані зберігаються через storage.js (файли або Mongo)
// Використовується в analyzeCorrelation

import WebSocket from "ws";
import { saveDoc } from "../../storage/storage.js";

export function BtcStepWS(symbol = "BTCUSDT") {
	const lower = symbol.toLowerCase();
	const ws = new WebSocket(`wss://fstream.binance.com/ws/${lower}@kline_1m`);

	ws.on("open", () => console.log(`✅ Connected to ${symbol} kline_1m`));
	ws.on("error", (err) => console.error("❌ BTC WS error:", err.message));

	ws.on("message", async (msg) => {
		const data = JSON.parse(msg.toString());
		const k = data.k;

		// k.x = чи закрита свічка (беремо тільки закриті!)
		if (k && k.x) {
			const candle = {
				symbol: k.s,
				time: new Date(k.t).toISOString(),
				open: parseFloat(k.o),
				high: parseFloat(k.h),
				low: parseFloat(k.l),
				close: parseFloat(k.c),
				volume: parseFloat(k.v),
			};

			// Зберігаємо у storage (файл або Mongo)
			await saveDoc("btc", candle);
		}
	});
}