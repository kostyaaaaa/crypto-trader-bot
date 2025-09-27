// import { CoinConfigModel } from 'crypto-trader-db';
// import connectDB from './config/database.js';
// // import dns from 'dns';
// // dns.setDefaultResultOrder('ipv4first');
// import { OrderBookStepWS } from './analize-modules/orderbook/order-book-step.js';
// import { LiquidationsStepWS } from './analize-modules/liquidations/liquidations-step.js';
// import { finalAnalyzer } from './utils/final-analyzer.js';
// import { tradingEngine } from './trading/core/engine.js';
// import { monitorPositions } from './trading/core/monitor.js';
// import { startUserStream } from './trading/binance/binance-ws-listener.js';
// const activeIntervals = {};
// startUserStream();
// async function startConfig(config) {
//   const { symbol, isActive, analysisConfig, strategy } = config;
//   if (!isActive) return;

//   const stopOB = OrderBookStepWS(symbol);
//   const stopLiq = LiquidationsStepWS(symbol);

//   // 🔹 Фінальний аналіз + запуск двигуна раз на хвилину
//   const analysisInterval = setInterval(async () => {
//     await finalAnalyzer({ symbol, analysisConfig });
//     await tradingEngine(symbol, { analysisConfig, strategy });
//   }, 60 * 1000);

//   // 🔹 Моніторинг відкритих позицій раз на 15 секунд
//   const monitorInterval = setInterval(async () => {
//     await monitorPositions({ symbol, strategy });
//   }, 15 * 1000);

//   // зберігаємо, щоб мати змогу чистити при апдейті/видаленні
//   activeIntervals[symbol] = {
//     analysisInterval,
//     monitorInterval,
//     stopOB,
//     stopLiq,
//   };
// }

// function stopConfig(symbol) {
//   const svc = activeIntervals[symbol];
//   if (!svc) return;
//   clearInterval(svc.analysisInterval);
//   clearInterval(svc.monitorInterval);
//   if (svc.stopOB) svc.stopOB();
//   if (svc.stopLiq) svc.stopLiq();
//   delete activeIntervals[symbol];
//   console.log(`🛑 Stopped services for ${symbol}`);
// }

// export async function subscribeCoinConfigs() {
//   // 1️⃣ При старті — витягуємо всі конфіги з БД
//   const allConfigs = await CoinConfigModel.find({});
//   console.log(
//     '📦 Initial configs:',
//     allConfigs.map((c) => c.symbol),
//   );

//   for (const cfg of allConfigs) {
//     await startConfig(cfg);
//   }

//   // 2️⃣ Слухаємо оновлення конфігів у БД
//   const changeStream = CoinConfigModel.watch([], {
//     fullDocument: 'updateLookup',
//   });

//   changeStream.on('change', async (change) => {
//     if (change.operationType === 'insert') {
//       const newConfig = change.fullDocument;
//       await startConfig(newConfig);
//     }

//     if (change.operationType === 'update') {
//       const updatedConfig = change.fullDocument;
//       stopConfig(updatedConfig.symbol); // прибираємо старе
//       await startConfig(updatedConfig); // запускаємо заново
//     }

//     if (change.operationType === 'delete') {
//       const symbol = change.documentKey._id; // треба буде зв'язати id → symbol
//       stopConfig(symbol);
//     }
//   });

//   changeStream.on('error', (err) => {
//     console.error('❌ Change stream error:', err);
//   });
// }
// connectDB();
// subscribeCoinConfigs();
