import pkg from 'binance-api-node';

const BinanceCtor: any = (pkg as any).default ?? pkg;

type TBinance = ReturnType<typeof BinanceCtor>;

// зберігаємо інстанс у глобалі, щоб не плодити клієнти при hot-reload
declare global {
  // eslint-disable-next-line no-var
  var __binanceClient: TBinance | undefined;
}

function createClient(): TBinance {
  const apiKey = process.env.BINANCE_API_KEY!;
  const apiSecret = process.env.BINANCE_ACCOUNT_SECRET_KEY!;
  if (!apiKey || !apiSecret) {
    throw new Error(
      'BINANCE_API_KEY / BINANCE_ACCOUNT_SECRET_KEY are required',
    );
  }
  return BinanceCtor({
    apiKey,
    apiSecret,
    futures: true,
    // httpBase: process.env.BINANCE_REST_BASE, // опційно, якщо треба кастомний хост
  });
}

// singleton
export const client: TBinance =
  global.__binanceClient ?? (global.__binanceClient = createClient());
