import { CoinConfigModel, type ICoinConfig } from 'crypto-trader-db';
import { Types } from 'mongoose';
import { CandlesStepWS } from './analize-modules/candles/candles-step';
import { LiquidationsStepWS } from './analize-modules/liquidations/liquidations-step';
import { LiquidityStepWS } from './analize-modules/liquidity/liquidity-step';
import connectDB from './config/database';
import { startReconciler } from './trading/binance/binance-ws-listener';
import cooldownHub from './trading/core/cooldown-hub';
import { tradingEngine } from './trading/core/engine';
import markPriceHub from './trading/core/mark-price-hub';
import { monitorPositions } from './trading/core/monitor';
import logger from './utils/db-logger';
import { finalAnalyzer } from './utils/final-analyzer';

type CoinConfigWithId = ICoinConfig & { _id: Types.ObjectId };
interface ActiveService {
  analysisInterval: NodeJS.Timeout;
  monitorInterval: NodeJS.Timeout;
  stopCandlesWS?: () => void;
  stopLiquidityWS?: () => void;
  stopLiq?: () => void;
}

const activeIntervals: Record<string, ActiveService> = {};
const idToSymbol: Record<string, string> = {};
const isBotActive = process.env.IS_BOT_ACTIVE === 'true';

async function startConfig(config: CoinConfigWithId): Promise<void> {
  const { symbol, isActive, analysisConfig, strategy, isTrader } = config;
  if (!isActive) return;

  const { higherMA } = analysisConfig;

  // Збираємо всі потрібні таймфрейми
  const candleTimeframe = analysisConfig.candleTimeframe || '15m';
  const timeframes = new Set<string>();

  // Основний таймфрейм
  timeframes.add(candleTimeframe);

  // Таймфрейм для openInterest (завжди 5m)
  timeframes.add('5m');

  // Таймфрейм для higherMA (якщо потрібен)
  if (higherMA && higherMA.timeframe) {
    timeframes.add(higherMA.timeframe);
  }

  const timeframesArray = Array.from(timeframes);

  // Запускаємо один WebSocket для всіх таймфреймів
  const stopCandlesWS = CandlesStepWS(symbol, timeframesArray);

  logger.info(
    `🕯️ Started WebSocket for ${symbol}@${timeframesArray.join(',')}`,
  );

  const stopLiquidityWS = LiquidityStepWS(symbol);
  const stopLiq = LiquidationsStepWS(symbol);

  // 🔹 Аналіз + запуск двигуна раз на хвилину
  const analysisInterval = setInterval(async () => {
    await finalAnalyzer({ symbol, analysisConfig, strategy });
    await tradingEngine({ symbol, analysisConfig, strategy, isTrader });
  }, 60_000);

  // 🔹 Моніторинг позицій раз на 10 секунд
  const monitorInterval = setInterval(async () => {
    // Add random delay to prevent simultaneous calls
    const delay = Math.random() * 5000; // 0-5 seconds random delay
    setTimeout(async () => {
      await monitorPositions({ symbol, strategy });
    }, delay);
  }, 10_000);

  activeIntervals[symbol] = {
    analysisInterval,
    monitorInterval,
    stopCandlesWS,
    stopLiquidityWS,
    stopLiq,
  };

  if (config._id) idToSymbol[String(config._id)] = symbol;
}

function stopConfig(symbol: string): void {
  const svc = activeIntervals[symbol];
  if (!svc) return;

  clearInterval(svc.analysisInterval);
  clearInterval(svc.monitorInterval);
  svc.stopCandlesWS?.();
  svc.stopLiquidityWS?.();
  svc.stopLiq?.();

  delete activeIntervals[symbol];
  for (const [id, sym] of Object.entries(idToSymbol)) {
    if (sym === symbol) delete idToSymbol[id];
  }

  logger.info(`🛑 Stopped services for ${symbol}`);
}

export async function subscribeCoinConfigs(): Promise<void> {
  const allConfigs = await CoinConfigModel.find({});
  logger.info(
    '📦 Initial configs:',
    allConfigs.map((c) => c.symbol),
  );

  for (const cfg of allConfigs) await startConfig(cfg);

  const changeStream = CoinConfigModel.watch([], {
    fullDocument: 'updateLookup',
  });

  changeStream.on('change', async (change: any) => {
    if (change.operationType === 'insert') {
      await startConfig(change.fullDocument);
    }

    if (change.operationType === 'update') {
      const updated = change.fullDocument;
      stopConfig(updated.symbol);
      await startConfig(updated);
    }

    if (change.operationType === 'delete') {
      const id = change.documentKey?._id
        ? String(change.documentKey._id)
        : null;
      const symbol = id ? idToSymbol[id] : null;
      if (symbol) stopConfig(symbol);
      else logger.info('⚠️ Delete event for unknown _id:', id);
    }
  });

  changeStream.on('error', (err: Error) => {
    logger.error('❌ Change stream error:', err);
  });
}

if (isBotActive) {
  connectDB();
  markPriceHub.init();
  cooldownHub.start();
  startReconciler(5 * 60 * 1000);
  subscribeCoinConfigs();
}
