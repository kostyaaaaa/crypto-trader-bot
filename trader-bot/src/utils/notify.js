// trading/utils/notify.js
import TelegramBot from "node-telegram-bot-api";

// 1. Бери токен і chatId з .env
const bot = new TelegramBot(process.env.TG_TOKEN, { polling: false });
const chatId = process.env.TG_CHAT_ID;

/**
 * Відправити повідомлення про трейд
 * @param {Object} position - об'єкт угоди
 * @param {string} action - "OPENED" | "CLOSED" | "UPDATED"
 */
export function notifyTrade(position, action) {
	if (!chatId || !process.env.TG_TOKEN) {
		console.warn("⚠️ Telegram notify skipped: TG_TOKEN or TG_CHAT_ID missing");
		return;
	}

	const tpList =
		position.takeProfits && position.takeProfits.length > 0
			? position.takeProfits.map((tp, i) => `TP${i + 1}: ${tp.price} (${tp.sizePct}%)`).join("\n")
			: "—";

	let title = `${action} ${position.symbol}`;
	if (action === "CLOSED" && position.exitReason) {
		title += ` (${position.exitReason})`; // 👈 покаже TP або SL
	}

	const msg = `
📊 <b>${title}</b>
Side: <b>${position.side}</b>
Entry: ${position.entryPrice}
Size: $${position.size} (Leverage ${position.leverage}x)
SL: ${position.stopPrice || "—"}
TPs:
${tpList}
RRR: ${position.rrrToFirstTp || "—"}
  `.trim();

	bot.sendMessage(chatId, msg, { parse_mode: "HTML" });
}

/**
 * Проста утиліта для текстових алертів
 */
export function notifyAlert(message) {
	if (!chatId || !process.env.TG_TOKEN) return;
	bot.sendMessage(chatId, `⚠️ ALERT: ${message}`);
}