// liquidations-step.js
// --- WebSocket для збору ліквідаційних подій (forceOrder) ---
// Кожну хвилину агрегуємо → зберігаємо "ліквідаційну свічку" у storage (файли або Mongo)

import WebSocket from "ws";
import { saveDoc } from "../../storage/storage.js";

export function LiquidationsStepWS(symbol = "ETHUSDT", minValue = 50_000, windowMs = 60_000) {
	// Binance stream: всі ліквідації
	const ws = new WebSocket("wss://fstream.binance.com/ws/!forceOrder@arr");

	let bucket = []; // буфер для ліквідацій за поточний інтервал (1 хв)

	ws.on("open", () =>
		console.log(`✅ Connected to Force Orders stream (symbol=${symbol}, minValue=${minValue})`)
	);

	ws.on("message", (msg) => {
		const raw = JSON.parse(msg.toString());
		const events = extractForceOrders(raw); // нормалізуємо в масив {e,o}

		for (const ev of events) {
			if (!ev || ev.e !== "forceOrder" || !ev.o) continue;
			const o = ev.o;

			// фільтруємо по символу
			if (o.s !== symbol) continue;

			const price = num(o.ap ?? o.p); // середня ціна (ap) якщо є, інакше (p)
			const qty = num(o.q);
			const value = price * qty;

			if (!isFinite(value) || value < minValue) continue;

			bucket.push({
				symbol: o.s,
				side: o.S, // BUY / SELL (кого ліквідували)
				price,
				qty,
				value,
				time: new Date(o.T || ev.E || Date.now()).toISOString(),
			});
		}
	});

	// Кожні windowMs (стандарт: 60с) формуємо "ліквідаційну свічку"
	setInterval(async () => {
		if (bucket.length === 0) return;

		const totalValue = bucket.reduce((s, x) => s + x.value, 0);
		const buys = bucket.filter((x) => x.side === "BUY");
		const sells = bucket.filter((x) => x.side === "SELL");

		const buysValue = buys.reduce((s, x) => s + x.value, 0);
		const sellsValue = sells.reduce((s, x) => s + x.value, 0);

		const candle = {
			symbol,
			time: new Date().toISOString(),
			count: bucket.length,
			buysCount: buys.length,
			sellsCount: sells.length,
			buysValue: round2(buysValue),
			sellsValue: round2(sellsValue),
			totalValue: round2(totalValue),
			minValue,
		};

		// Зберігаємо у storage (файл або Mongo)
		await saveDoc("liquidations", candle);

		// очищаємо буфер на наступну хвилину
		bucket = [];
	}, windowMs);

	ws.on("error", (err) => console.error("❌ WS error:", err.message));
	ws.on("close", () => {
		console.log("⚠️ WS closed, reconnecting...");
		setTimeout(() => LiquidationsStepWS(symbol, minValue, windowMs), 5000);
	});
}

/* ---------- helpers ---------- */
function extractForceOrders(raw) {
	if (Array.isArray(raw)) return raw;
	if (raw?.data) return Array.isArray(raw.data) ? raw.data : [raw.data];
	return [raw];
}

const num = (x) => Number(x);
const round2 = (x) => Math.round(x * 100) / 100;