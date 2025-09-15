import WebSocket from 'ws';
import fs from 'fs';

export function OrderBookStepWS(symbol = 'BTCUSDT') {
	const ws = new WebSocket(`wss://fstream.binance.com/ws/${symbol.toLowerCase()}@depth10@100ms`);

	let imbalances = [];
	let spreads = [];

	ws.on('open', () => {
		console.log(`✅ Connected to Binance OrderBook WS (${symbol})`);
	});

	ws.on('message', (msg) => {
		const data = JSON.parse(msg.toString());
		if (!data.b || !data.a) return;

		const bids = data.b;
		const asks = data.a;

		const bidValue = bids.reduce((sum, [price, qty]) => sum + parseFloat(price) * parseFloat(qty), 0);
		const askValue = asks.reduce((sum, [price, qty]) => sum + parseFloat(price) * parseFloat(qty), 0);

		const imbalance = bidValue / (bidValue + askValue);
		const spread = parseFloat(asks[0][0]) - parseFloat(bids[0][0]);

		imbalances.push(imbalance);
		spreads.push(spread);
	});

	ws.on('error', (err) => {
		console.error('❌ WS error:', err.message);
	});

	ws.on('close', () => {
		console.log('⚠️ WS closed, reconnecting...');
		setTimeout(() => OrderBookStepWS(symbol), 5000);
	});

	// раз у хвилину рахуємо середнє і пишемо у файл
	setInterval(() => {
		if (imbalances.length === 0) return;

		const avgImbalance = imbalances.reduce((a, b) => a + b, 0) / imbalances.length;
		const avgSpread = spreads.reduce((a, b) => a + b, 0) / spreads.length;

		const liquidityCandle = {
			symbol,
			time: new Date().toISOString(),
			avgImbalance: parseFloat(avgImbalance.toFixed(3)),
			avgSpread: parseFloat(avgSpread.toFixed(2)),
			signal:
				avgImbalance > 0.55 ? 'LONG' :
					avgImbalance < 0.45 ? 'SHORT' : 'NEUTRAL'
		};

		let liquidity = [];
		try {
			liquidity = JSON.parse(fs.readFileSync('liquidity.json', 'utf-8'));
		} catch (e) {
			liquidity = [];
		}

		// додаємо нову свічку
		liquidity.push(liquidityCandle);

		// тримаємо останні 100 свічок
		if (liquidity.length > 100) {
			liquidity = liquidity.slice(-100);
		}

		fs.writeFileSync('liquidity.json', JSON.stringify(liquidity, null, 2));


		imbalances = [];
		spreads = [];
	}, 60000);
}