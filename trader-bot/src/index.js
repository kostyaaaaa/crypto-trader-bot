import connectDB from './config/database.js';

import { OrderBookStepWS } from './modules/orderbook/order-book-step.js';
import { LiquidationsStepWS } from './modules/liquidations/liquidations-step.js';
import { finalAnalyzer } from './utils/final-analyzer.js';

import { ANALYSIS_CONFIG } from './constants/mock.js';
import { tradingEngine } from './trading/core/engine.js';
import { monitorPositions } from './trading/core/monitor.js';
import { startUserStream } from './trading/binance/ws-listener.js';
// import {CoinConfigModel} from "crypto-trader-db";

// === 2. Для кожної монети з конфіга запускаємо процеси ===
startUserStream();
Object.entries(ANALYSIS_CONFIG).forEach(([symbol, cfg]) => {
  const { analysisConfig, strategy } = cfg;
  OrderBookStepWS(symbol);
  LiquidationsStepWS(symbol);

  // Фінальний аналіз + запуск двигуна раз на хвилину
  setInterval(async () => {
    await finalAnalyzer({ symbol, analysisConfig });
    await tradingEngine(symbol, cfg);
  }, 60 * 1000);

  // Моніторинг відкритих позицій раз на 15 секунд
  setInterval(async () => {
    await monitorPositions({ symbol, strategy });
  }, 15 * 1000);
});

// async function loadCoinConfigs() {
//   try {
//     const configs = await CoinConfigModel.find({}).sort({ symbol: 1 }).lean();
//     console.log(`✅ Loaded ${configs?.length} coin configs`);
//     return configs;
//   } catch (err) {
//     console.error("❌ Failed to load coin configs:", err.message);
//     return [];
//   }
// }
// // Initialize database connection
// const startTraderBot = async () => {
//   try {
//     await connectDB();
//
//     const coinConfigs = await loadCoinConfigs();
//     // тут ініціалізуєш аналітику для кожного
//     // for (const cfg of coinConfigs) {
//     //   startAnalyzer(cfg.symbol, cfg); // умовна функція запуску
//     // }
//
//     console.log(coinConfigs);
//   } catch (error) {
//     console.error('Failed to start Trader Bot:', error);
//     process.exit(1);
//   }
// };
//
// startTraderBot();
