import type { OpenOrder } from '../../../types/index';
import logger from '../../../utils/db-logger';
import { client } from './client';

export async function cancelStopOrders(
  symbol: string,
  {
    onlySL = false,
    onlyTP = false,
  }: { onlySL?: boolean; onlyTP?: boolean } = {},
): Promise<void> {
  try {
    const orders = (await client.futuresOpenOrders({ symbol })) as OpenOrder[];
    if (!Array.isArray(orders) || orders.length === 0) return;

    const isSL = (o: OpenOrder) =>
      o.type === 'STOP_MARKET' ||
      o.origType === 'STOP_MARKET' ||
      o.type === 'STOP' ||
      o.origType === 'STOP' ||
      o.type === 'TRAILING_STOP_MARKET' ||
      o.origType === 'TRAILING_STOP_MARKET';

    const isTP = (o: OpenOrder) =>
      o.type === 'TAKE_PROFIT_MARKET' ||
      o.origType === 'TAKE_PROFIT_MARKET' ||
      o.type === 'TAKE_PROFIT' ||
      o.origType === 'TAKE_PROFIT';

    const toCancel = orders.filter((o) => {
      if (onlySL) return isSL(o);
      if (onlyTP) return isTP(o);
      return isSL(o) || isTP(o);
    });

    await Promise.allSettled(
      toCancel.map((o) =>
        client
          .futuresCancelOrder({ symbol, orderId: o.orderId })
          .then(() =>
            logger.info(`❌ Canceled ${o.type} @ ${symbol} (${o.orderId})`),
          )
          .catch((err: any) =>
            logger.warn(
              `⚠️ Cancel ${o.type} ${o.orderId} failed: ${err?.message || err}`,
            ),
          ),
      ),
    );
  } catch (err: any) {
    logger.error(
      `❌ cancelStopOrders failed for ${symbol}:`,
      err?.message || err,
    );
  }
}
