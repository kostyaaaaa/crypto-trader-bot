// storage.js
import fs from "fs";
import dotenv from "dotenv";
dotenv.config();
const USE_FILES = process.env.USE_FILES === "true";

/**
 * Зберегти документ (свічку, метрику і т.д.)
 * @param {string} collection - назва колекції (candles, openinterest...)
 * @param {object} doc - документ { symbol, time, ... }
 * @param {number} [maxDocs=2000] - максимум документів для зберігання
 */
export async function saveDoc(collection, doc, maxDocs = 2000) {
	if (USE_FILES) {
		let db = [];
		try {
			db = JSON.parse(fs.readFileSync(`${collection}.json`, "utf-8"));
			if (!Array.isArray(db)) db = [];
		} catch {
			db = [];
		}

		db.push(doc);

		// тримаємо тільки останні maxDocs
		if (db.length > maxDocs) {
			db = db.slice(-maxDocs);
		}

		fs.writeFileSync(`${collection}.json`, JSON.stringify(db, null, 2));
	} else {
		// --- Mongo режим ---
		// await global.mongo.db().collection(collection).insertOne(doc);
	}
}


export async function loadDocs(collection, symbol, limit = 100 ) {
	if (USE_FILES) {
		let db = [];
		try {
			db = JSON.parse(fs.readFileSync(`${collection}.json`, "utf-8"));
			if (!Array.isArray(db)) db = [];
		} catch {
			db = [];
		}

		if (symbol) {
			db = db.filter((d) => d.symbol === symbol);
		}

		if (limit && db.length > limit) {
			return db.slice(-limit);
		}
		return db;
	} else {
		// --- Mongo режим ---
		const query = symbol ? { symbol } : {};
		// return await global.mongo
		// 	.db()
		// 	.collection(collection)
		// 	.find(query)
		// 	.sort({ time: -1 })
		// 	.limit(limit)
		// 	.toArray();
	}
}