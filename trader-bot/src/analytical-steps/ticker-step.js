import WebSocket from "ws";
import fs from 'fs';
const candles = [];
function addCandle(candle) {
	candles.push(candle);

	fs.writeFileSync('candles.json', JSON.stringify(candles, null, 2));
}
export function TickerStepWS(symbol) {
	const lower = symbol.toLowerCase();

	const wsKline = new WebSocket(`wss://fstream.binance.com/ws/${lower}@kline_1m`);

	const wsBook = new WebSocket(`wss://fstream.binance.com/ws/${lower}@bookTicker`);

	let bidSum = 0;
	let askSum = 0;
	let count = 0;

	wsBook.on("message", (msg) => {
		const data = JSON.parse(msg.toString());
		bidSum += parseFloat(data.b);
		askSum += parseFloat(data.a);
		count++;
	});

	wsKline.on("message", (msg) => {
		const data = JSON.parse(msg.toString());
		const k = data.k;

		if (k.x) {
			const candle = {
				symbol: k.s,
				time: new Date(k.t).toISOString(),
				open: parseFloat(k.o),
				high: parseFloat(k.h),
				low: parseFloat(k.l),
				close: parseFloat(k.c),
				volume: parseFloat(k.v),
				avgBid: count > 0 ? bidSum / count : null,
				avgAsk: count > 0 ? askSum / count : null,
				spread: count > 0 ? (askSum / count) - (bidSum / count) : null,
			};

			addCandle(candle)
			bidSum = 0;
			askSum = 0;
			count = 0;
		}
	});

	wsKline.on("open", () => console.log(`✅ Connected to ${symbol} kline_1m`));
	wsBook.on("open", () => console.log(`✅ Connected to ${symbol} bookTicker`));

	wsKline.on("error", console.error);
	wsBook.on("error", console.error);
}