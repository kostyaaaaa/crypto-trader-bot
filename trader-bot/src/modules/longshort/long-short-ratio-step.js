// long-short-ratio-step.js
// --- Збирає глобальне співвідношення Long vs Short акаунтів з Binance ---
// API: /futures/data/globalLongShortAccountRatio
// Період: 5m → одна "свічка" кожні 5 хв

import axios from "axios";
import { saveDoc } from "../../storage/storage.js";

export async function LongShortRatioStep(symbol = "BTCUSDT") {
	try {
		const url = `https://fapi.binance.com/futures/data/globalLongShortAccountRatio`;
		const res = await axios.get(url, {
			params: {
				symbol,
				period: "5m", // можна: 5m, 15m, 1h, 4h, 1d
				limit: 1,     // беремо останню точку
			},
		});

		if (!res.data || res.data.length === 0) {
			console.log("⚠️ No long/short ratio data");
			return null;
		}

		const ratio = res.data[0];

		const candle = {
			symbol,
			time: new Date(ratio.timestamp).toISOString(),
			longPct: parseFloat(ratio.longAccount) * 100,   // % акаунтів у лонгах
			shortPct: parseFloat(ratio.shortAccount) * 100, // % акаунтів у шортах
			ratio: parseFloat(ratio.longShortRatio),        // співвідношення long/short
			// Логіка сигналу:
			signal:
				parseFloat(ratio.longShortRatio) > 1.2 ? "SHORT" :
					parseFloat(ratio.longShortRatio) < 0.8 ? "LONG" :
						"NEUTRAL",
		};

		// Зберігаємо у storage (файл або Mongo)
		await saveDoc("longshort", candle);

		return candle;
	} catch (e) {
		console.error("❌ Error fetching long/short ratio:", e.message);
		return null;
	}
}