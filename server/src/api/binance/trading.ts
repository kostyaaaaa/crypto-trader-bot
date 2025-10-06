import crypto from 'crypto';
import logger from '../../utils/Logger.js';

const BASE_URL = 'https://fapi.binance.com';

function signParams(params: Record<string, string | number | boolean>): string {
  const stringParams: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    stringParams[key] = String(value);
  }
  const query = new URLSearchParams(stringParams).toString();
  const signature = crypto
    .createHmac('sha256', process.env.BINANCE_ACCOUNT_SECRET_KEY!)
    .update(query)
    .digest('hex');
  return `${query}&signature=${signature}`;
}

/**
 * Close a position on Binance
 */
export async function closePosition(
  symbol: string,
  side: string,
  quantity: number,
): Promise<{
  orderId: number;
  symbol: string;
  status: string;
  side: string;
  type: string;
  quantity: string;
}> {
  try {
    const endpoint = '/fapi/v1/order';
    const timestamp = Date.now();

    // Determine the opposite side for closing
    const closeSide = side === 'LONG' ? 'SELL' : 'BUY';

    const params = {
      symbol,
      side: closeSide,
      type: 'MARKET',
      quantity: quantity.toString(),
      reduceOnly: true,
      timestamp,
      recvWindow: 5000,
    };

    const query = signParams(params);
    const res = await fetch(`${BASE_URL}${endpoint}?${query}`, {
      method: 'POST',
      headers: { 'X-MBX-APIKEY': process.env.BINANCE_API_KEY! },
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Binance closePosition error: ${res.status} ${err}`);
    }

    const result = await res.json();
    logger.info(`Position closed successfully for ${symbol}:`, result);
    return result;
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error(`Failed to close position for ${symbol}:`, errorMessage);
    throw err;
  }
}

/**
 * Cancel all stop orders for a symbol
 */
export async function cancelStopOrders(symbol: string): Promise<void> {
  try {
    const endpoint = '/fapi/v1/openOrders';
    const timestamp = Date.now();

    // First, get all open orders
    const params = {
      symbol,
      timestamp,
      recvWindow: 5000,
    };

    const query = signParams(params);
    const res = await fetch(`${BASE_URL}${endpoint}?${query}`, {
      method: 'GET',
      headers: { 'X-MBX-APIKEY': process.env.BINANCE_API_KEY! },
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Binance getOpenOrders error: ${res.status} ${err}`);
    }

    const orders = (await res.json()) as Array<{
      orderId: number;
      type: string;
      origType: string;
      symbol: string;
    }>;

    // Filter for stop orders (SL/TP)
    const stopOrders = orders.filter(
      (order) =>
        order.type === 'STOP_MARKET' ||
        order.type === 'TAKE_PROFIT_MARKET' ||
        order.origType === 'STOP_MARKET' ||
        order.origType === 'TAKE_PROFIT_MARKET',
    );

    // Cancel each stop order
    for (const order of stopOrders) {
      try {
        const cancelParams = {
          symbol,
          orderId: order.orderId,
          timestamp: Date.now(),
          recvWindow: 5000,
        };

        const cancelQuery = signParams(cancelParams);
        const cancelRes = await fetch(
          `${BASE_URL}/fapi/v1/order?${cancelQuery}`,
          {
            method: 'DELETE',
            headers: { 'X-MBX-APIKEY': process.env.BINANCE_API_KEY! },
          },
        );

        if (cancelRes.ok) {
          logger.info(
            `Canceled ${order.type} order for ${symbol} (${order.orderId})`,
          );
        } else {
          const err = await cancelRes.text();
          logger.error(`Failed to cancel order ${order.orderId}: ${err}`);
        }
      } catch (err: any) {
        logger.error(`Error canceling order ${order.orderId}:`, err.message);
      }
    }
  } catch (err: any) {
    logger.error(`Failed to cancel stop orders for ${symbol}:`, err.message);
    throw err;
  }
}

/**
 * Get current position for a symbol
 */
export async function getPosition(symbol: string): Promise<{
  symbol: string;
  positionAmt: string;
  entryPrice: string;
  markPrice: string;
} | null> {
  try {
    const endpoint = '/fapi/v2/positionRisk';
    const timestamp = Date.now();

    const params = {
      symbol,
      timestamp,
      recvWindow: 5000,
    };

    const query = signParams(params);
    const res = await fetch(`${BASE_URL}${endpoint}?${query}`, {
      method: 'GET',
      headers: { 'X-MBX-APIKEY': process.env.BINANCE_API_KEY! },
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Binance getPosition error: ${res.status} ${err}`);
    }

    const positions = (await res.json()) as Array<{
      symbol: string;
      positionAmt: string;
      entryPrice: string;
      markPrice: string;
    }>;
    return positions.find((p) => p.symbol === symbol) || null;
  } catch (err: any) {
    logger.error(`Failed to get position for ${symbol}:`, err.message);
    throw err;
  }
}
