// import { TickerStepWS } from "./modules/candles/ticker-step.js";
// import { OrderBookStepWS } from "./modules/orderbook/order-book-step.js";
// import { LiquidationsStepWS } from "./modules/liquidations/liquidations-step.js";
// import { LongShortRatioStep } from "./modules/longshort/long-short-ratio-step.js";
// import { OpenInterestStep } from "./modules/openinterest/open-interest-step.js";
// import { BtcStepWS } from "./modules/correlation/btc-step.js";
// import { FundingStep } from "./modules/funding/funding-step.js";
// import { finalAnalyzer } from "./utils/final-analyzer.js";
//
// import { ANALYSIS_CONFIG } from "./constants/mock.js";
// import {tradingEngine} from "./trading/engine.js";
//
// // === 1. Запускаємо BTC WebSocket для кореляції ===
// BtcStepWS("BTCUSDT");
//
// // === 2. Для кожної монети з конфіга запускаємо процеси ===
// Object.entries(ANALYSIS_CONFIG).forEach(([symbol, cfg]) => {
// 	const { analysisConfig } = cfg;
//
// 	// WS модулі
// 	OrderBookStepWS(symbol);
// 	TickerStepWS(symbol);
// 	LiquidationsStepWS(symbol);
//
// 	// API дані раз на хвилину
// 	setInterval(() => {
// 		LongShortRatioStep(symbol);
// 		OpenInterestStep(symbol);
// 		FundingStep(symbol);
// 	}, 60 * 1000);
//
// 	// Фінальний аналіз раз на хвилину
// 	setInterval(async () => {
// 		await finalAnalyzer({ symbol, analysisConfig });
// 		await tradingEngine(symbol, cfg);
// 	}, 60 * 1000);
// });
