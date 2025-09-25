import connectDB from './config/database.js';

import { OrderBookStepWS } from './modules/orderbook/order-book-step.js';
import { LiquidationsStepWS } from './modules/liquidations/liquidations-step.js';
import { finalAnalyzer } from './utils/final-analyzer.js';

import { ANALYSIS_CONFIG } from './constants/mock.js';
import { tradingEngine } from './trading/core/engine.js';
import { monitorPositions } from './trading/core/monitor.js';
import { startUserStream } from './trading/binance/ws-listener.js';
import { CoinConfigModel } from 'crypto-trader-db';
const TRADE_MODE = process.env.TRADE_MODE || 'paper';

// async function loadCoinConfigs() {
//   if (TRADE_MODE === 'paper') {
//     console.log(`📄 Using local configs (${localConfigs.length})`);
//     return localConfigs;
//   }
//
//   try {
//     await connectDB();
//     const configs = await CoinConfigModel.find({}).sort({ symbol: 1 }).lean();
//     console.log(`✅ Loaded ${configs.length} coin configs from Mongo`);
//     return configs;
//   } catch (err) {
//     console.error('❌ Failed to load coin configs:', err.message);
//     return [];
//   }
// }

// === 2. Для кожної монети з конфіга запускаємо процеси ===
startUserStream();
ANALYSIS_CONFIG.forEach(({ symbol, isActive, analysisConfig, strategy }) => {
  if (!isActive) {
    return;
  }

  OrderBookStepWS(symbol);
  LiquidationsStepWS(symbol);

  // Фінальний аналіз + запуск двигуна раз на хвилину
  setInterval(async () => {
    await finalAnalyzer({ symbol, analysisConfig });
    await tradingEngine(symbol, { analysisConfig, strategy });
  }, 60 * 1000);

  // Моніторинг відкритих позицій раз на 15 секунд
  setInterval(async () => {
    await monitorPositions({ symbol, strategy });
  }, 15 * 1000);
});

async function subscribeCoinConfigs() {
  const changeStream = CoinConfigModel.watch([], {
    fullDocument: 'updateLookup',
  });

  changeStream.on('change', (change) => {
    console.log('🔔 CoinConfig change:', change);

    if (change.operationType === 'insert') {
      const newConfig = change.fullDocument;
      console.log('➕ New config added:', newConfig.symbol);
      // startAnalyzer(newConfig.symbol, newConfig);
    }

    if (
      change.operationType === 'update' ||
      change.operationType === 'replace'
    ) {
      const updatedConfig = change.fullDocument;
      console.log('♻️ Config updated:', updatedConfig.symbol);
      // перезапусти аналітику для цієї монети
    }

    if (change.operationType === 'delete') {
      console.log('🗑️ Config removed:', change.documentKey._id);
      // зупини аналізатор для цього символа
    }
  });

  changeStream.on('error', (err) => {
    console.error('❌ Change stream error:', err);
  });
}
await connectDB();
await subscribeCoinConfigs();
