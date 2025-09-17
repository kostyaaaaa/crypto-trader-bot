// trading/positions.js
import { saveDoc, loadDocs } from "../storage/storage.js";

export async function getActivePositions(symbol) {
	return await loadDocs("positions",  symbol );
}

export async function addPosition(position) {
	return await saveDoc("positions", position);
}

export async function closePosition(id, closeData) {
	// завантажуємо всі позиції
	const positions = await loadDocs("positions");
	const pos = positions.find((p) => p.id === id);
	if (!pos) return null;

	// оновлюємо
	pos.status = "CLOSED";
	pos.closedAt = new Date().toISOString();
	pos.closeData = closeData;

	await saveDoc("history", pos);   // архівуємо у history
	return pos;
}