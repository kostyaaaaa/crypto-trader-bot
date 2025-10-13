import { CoinConfigModel, type ICoinConfig } from 'crypto-trader-db';
import { Types } from 'mongoose';
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
  stopLiquidityWS?: () => void;
  stopLiq?: () => void;
}

const activeIntervals: Record<string, ActiveService> = {};
const idToSymbol: Record<string, string> = {};
const isBotActive = process.env.IS_BOT_ACTIVE === 'true';

async function startConfig(config: CoinConfigWithId): Promise<void> {
  const { symbol, isActive, analysisConfig, strategy } = config;
  if (!isActive) return;

  const stopLiquidityWS = LiquidityStepWS(symbol);
  const stopLiq = LiquidationsStepWS(symbol);

  // 🔹 Аналіз + запуск двигуна раз на хвилину
  const analysisInterval = setInterval(async () => {
    await finalAnalyzer({ symbol, analysisConfig, strategy });
    await tradingEngine({ symbol, analysisConfig, strategy });
  }, 60_000);

  // 🔹 Моніторинг позицій раз на 10 секунд
  const monitorInterval = setInterval(async () => {
    await monitorPositions({ symbol, strategy });
  }, 10_000);

  activeIntervals[symbol] = {
    analysisInterval,
    monitorInterval,
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
  startReconciler(2 * 60 * 1000);
  subscribeCoinConfigs();
}
