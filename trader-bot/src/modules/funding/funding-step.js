// funding-step.js
// --- Збирає Funding Rate з Binance ---
// API: /fapi/v1/fundingRate
// Кожен виклик дає останні N записів по символу (наприклад, 1 запис = останній funding)

// Використовуємо saveDoc → зберігаємо у файли/Mongo як і інші кроки

import axios from "axios";
import { saveDoc } from "../../storage/storage.js";

export async function FundingStep(symbol = "ETHUSDT") {
	try {
		const url = "https://fapi.binance.com/fapi/v1/fundingRate";
		const res = await axios.get(url, {
			params: {
				symbol,
				limit: 1, // беремо останній запис
			},
		});

		if (!res.data || res.data.length === 0) {
			console.log(`⚠️ No funding data for ${symbol}`);
			return null;
		}

		const fr = res.data[0];

		const doc = {
			symbol,
			time: new Date(fr.fundingTime).toISOString(),
			fundingRate: parseFloat(fr.fundingRate), // власне значення
		};

		// зберігаємо у storage (файл/Mongo)
		await saveDoc("funding", doc);

		return doc;
	} catch (e) {
		console.error(`❌ Funding fetch error for ${symbol}:`, e.message);
		return null;
	}
}