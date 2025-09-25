import connectDB from './config/database.js';

import { TickerStepWS } from './modules/candles/ticker-step.js';
import { OrderBookStepWS } from './modules/orderbook/order-book-step.js';
import { LiquidationsStepWS } from './modules/liquidations/liquidations-step.js';
import { LongShortRatioStep } from './modules/longshort/long-short-ratio-step.js';
import { OpenInterestStep } from './modules/openinterest/open-interest-step.js';
import { BtcStepWS } from './modules/correlation/btc-step.js';
import { FundingStep } from './modules/funding/funding-step.js';
import { finalAnalyzer } from './utils/final-analyzer.js';

import { ANALYSIS_CONFIG } from './constants/mock.js';
import { tradingEngine } from './trading/engine.js';
import { monitorPositions } from './trading/monitor.js';

// === 1. Запускаємо BTC WebSocket для кореляції ===
// BtcStepWS('BTCUSDT');
//
// // === 2. Для кожної монети з конфіга запускаємо процеси ===
// Object.entries(ANALYSIS_CONFIG).forEach(([symbol, cfg]) => {
//   const { analysisConfig, strategy } = cfg;
//   // WS модулі
//   OrderBookStepWS(symbol);
//   TickerStepWS(symbol);
//   LiquidationsStepWS(symbol);
//
//   // API дані раз на хвилину
//   setInterval(() => {
//     LongShortRatioStep(symbol);
//     OpenInterestStep(symbol);
//     FundingStep(symbol);
//   }, 60 * 1000);
//
//   // Фінальний аналіз + запуск двигуна раз на хвилину
//   setInterval(async () => {
//     await finalAnalyzer({ symbol, analysisConfig });
//     await tradingEngine(symbol, cfg);
//   }, 60 * 1000);
//
//   // Моніторинг відкритих позицій раз на 15 секунд
//   setInterval(async () => {
//     await monitorPositions({ symbol, strategy });
//   }, 15 * 1000);
// });
//
//
// // Initialize database connection
// const startTraderBot = async () => {
//   try {
//     // Connect to MongoDB
//     await connectDB();
//
//     console.log('Trader Bot initialized successfully');
//   } catch (error) {
//     console.error('Failed to start Trader Bot:', error);
//     process.exit(1);
//   }
// };
//
// startTraderBot();
