// exchanges/binance.js
import pkg from 'binance-api-node';
import crypto from 'crypto';
import logger from '../../utils/db-logger.js';

const Binance = pkg.default;
const BASE_URL = 'https://fapi.binance.com';

export const client = Binance({
  apiKey: process.env.BINANCE_API_KEY,
  apiSecret: process.env.BINANCE_ACCOUNT_SECRET_KEY,
  futures: true,
});

/* ========= Helpers ========= */

function normalizeOrderSide(side) {
  const s = String(side).toUpperCase();
  if (s === 'LONG' || s === 'BUY') return 'BUY';
  if (s === 'SHORT' || s === 'SELL') return 'SELL';
  throw new Error(`Unknown side: ${side}`);
}

function oppositeOrderSide(side) {
  return normalizeOrderSide(side) === 'BUY' ? 'SELL' : 'BUY';
}

/* ========= Exchange info / filters ========= */

export async function getSymbolFilters(symbol) {
  try {
    const info = await client.futuresExchangeInfo();
    const sym = info.symbols.find((s) => s.symbol === symbol);
    return sym?.filters || [];
  } catch (err) {
    logger.error(`❌ getSymbolFilters failed for ${symbol}:`, err.message);
    return [];
  }
}

export async function getSymbolInfo(symbol) {
  try {
    const info = await client.futuresExchangeInfo();
    return info.symbols.find((s) => s.symbol === symbol) || null;
  } catch (err) {
    logger.error(`❌ getSymbolInfo failed for ${symbol}:`, err.message);
    return null;
  }
}

/* ========= Quantization ========= */

export function adjustQuantity(symbolFilters, qty) {
  const lotFilter =
    symbolFilters.find((f) => f.filterType === 'MARKET_LOT_SIZE') ||
    symbolFilters.find((f) => f.filterType === 'LOT_SIZE');
  if (!lotFilter) return String(qty);

  const stepSize = parseFloat(lotFilter.stepSize);
  const minQty = parseFloat(lotFilter.minQty ?? '0');
  const precision =
    stepSize === 1 ? 0 : (stepSize.toString().split('.')[1] || '').length;

  let q = Math.floor(Number(qty) / stepSize) * stepSize;
  if (!isFinite(q) || q <= 0) q = 0;
  if (q < minQty) q = 0;

  return q.toFixed(precision);
}

export function adjustPrice(symbolFilters, price) {
  const priceFilter = symbolFilters.find(
    (f) => f.filterType === 'PRICE_FILTER',
  );
  if (!priceFilter) return String(price);

  const tickSize = parseFloat(priceFilter.tickSize);
  const precision =
    tickSize === 1 ? 0 : (tickSize.toString().split('.')[1] || '').length;

  let p = Math.floor(Number(price) / tickSize) * tickSize;
  if (!isFinite(p) || p <= 0) p = 0;

  return p.toFixed(precision);
}

/* ========= Account utils ========= */

export async function getFuturesBalance(asset = 'USDT') {
  try {
    const balances = await client.futuresAccountBalance();
    return balances.find((b) => b.asset === asset)?.balance || 0;
  } catch (err) {
    logger.error(`❌ getFuturesBalance failed for ${asset}:`, err.message);
    return 0;
  }
}

export async function getPosition(symbol) {
  try {
    const positions = await client.futuresPositionRisk();
    return positions.find((p) => p.symbol === symbol) || null;
  } catch (err) {
    logger.error(`❌ getPosition failed for ${symbol}:`, err.message);
    return null;
  }
}

export async function getOpenOrders(symbol) {
  try {
    return await client.futuresOpenOrders({ symbol });
  } catch (err) {
    logger.error(`❌ getOpenOrders failed for ${symbol}:`, err.message);
    return [];
  }
}

/* ========= Orders ========= */

export async function openMarketOrder(symbol, side, quantity) {
  try {
    const filters = await getSymbolFilters(symbol);
    const orderSide = normalizeOrderSide(side);
    const qty = adjustQuantity(filters, quantity);

    if (!qty || Number(qty) <= 0) {
      throw new Error(`Quantity too small for ${symbol}: ${quantity}`);
    }

    return await client.futuresOrder({
      symbol,
      side: orderSide,
      type: 'MARKET',
      quantity: qty,
    });
  } catch (err) {
    logger.error(`❌ openMarketOrder failed for ${symbol}:`, err.message);
    throw err; // хай летить, бо це критично
  }
}

export async function placeStopLoss(symbol, positionSide, stopPrice, quantity) {
  try {
    const filters = await getSymbolFilters(symbol);
    const closeSide = oppositeOrderSide(positionSide);
    const qty = adjustQuantity(filters, quantity);
    const price = adjustPrice(filters, stopPrice);

    if (!qty || Number(qty) <= 0)
      throw new Error(`SL qty too small for ${symbol}`);
    if (!price || Number(price) <= 0)
      throw new Error(`SL price invalid for ${symbol}`);

    return await client.futuresOrder({
      symbol,
      side: closeSide,
      type: 'STOP_MARKET',
      stopPrice: price,
      quantity: qty,
      reduceOnly: true,
    });
  } catch (err) {
    logger.error(`❌ placeStopLoss failed for ${symbol}:`, err.message);
    return null;
  }
}

export async function placeTakeProfit(symbol, positionSide, tpPrice, quantity) {
  try {
    const filters = await getSymbolFilters(symbol);
    const closeSide = oppositeOrderSide(positionSide);
    const qty = adjustQuantity(filters, quantity);
    const price = adjustPrice(filters, tpPrice);

    if (!qty || Number(qty) <= 0)
      throw new Error(`TP qty too small for ${symbol}`);
    if (!price || Number(price) <= 0)
      throw new Error(`TP price invalid for ${symbol}`);

    return await client.futuresOrder({
      symbol,
      side: closeSide,
      type: 'TAKE_PROFIT_MARKET',
      stopPrice: price,
      quantity: qty,
      reduceOnly: true,
    });
  } catch (err) {
    logger.error(`❌ placeTakeProfit failed for ${symbol}:`, err.message);
    return null;
  }
}

export async function closePosition(symbol, side, quantity) {
  try {
    const filters = await getSymbolFilters(symbol);
    const closeSide = oppositeOrderSide(side);
    const qty = adjustQuantity(filters, quantity);

    if (!qty || Number(qty) <= 0) {
      throw new Error(`Close qty too small for ${symbol}: ${quantity}`);
    }

    return await client.futuresOrder({
      symbol,
      side: closeSide,
      type: 'MARKET',
      quantity: qty,
      reduceOnly: true,
    });
  } catch (err) {
    logger.error(`❌ closePosition failed for ${symbol}:`, err.message);
    return null;
  }
}

/* ========= Queries / maintenance ========= */

export async function getOpenPositions() {
  try {
    return await client.futuresPositionRisk();
  } catch (err) {
    logger.error('❌ getOpenPositions failed:', err.message);
    return [];
  }
}

export async function cancelAllOrders(symbol) {
  try {
    return await client.futuresCancelAllOpenOrders({ symbol });
  } catch (err) {
    logger.error(`❌ cancelAllOrders failed for ${symbol}:`, err.message);
    return null;
  }
}

/* ========= Sync helpers ========= */

export async function getLiveState(symbol) {
  try {
    const positions = await client.futuresPositionRisk();
    const pos = positions.find((p) => p.symbol === symbol);

    let position = { side: null, size: 0, entryPrice: null };
    if (pos) {
      const size = parseFloat(pos.positionAmt);
      position = {
        side: size > 0 ? 'LONG' : size < 0 ? 'SHORT' : null,
        size: Math.abs(size),
        entryPrice: size !== 0 ? parseFloat(pos.entryPrice) : null,
      };
    }

    const openOrders = await client.futuresOpenOrders({ symbol });
    const orders = openOrders
      .map((o) => {
        const qty = parseFloat(o.origQty);
        const stopPrice = parseFloat(o.stopPrice);
        const type = o.type.includes('STOP')
          ? 'SL'
          : o.type.includes('TAKE_PROFIT')
            ? 'TP'
            : 'OTHER';

        return {
          type,
          price: stopPrice || parseFloat(o.price) || null,
          qty,
          side: o.side,
          reduceOnly: o.reduceOnly,
        };
      })
      .filter((o) => o.type !== 'OTHER');

    return { position, orders };
  } catch (err) {
    logger.error(`❌ getLiveState failed for ${symbol}:`, err.message);
    return { position: null, orders: [] };
  }
}

/* ========= Leverage ========= */

function signParams(params) {
  const query = new URLSearchParams(params).toString();
  const signature = crypto
    .createHmac('sha256', process.env.BINANCE_ACCOUNT_SECRET_KEY)
    .update(query)
    .digest('hex');
  return `${query}&signature=${signature}`;
}

export async function setLeverage(symbol, leverage) {
  try {
    const endpoint = '/fapi/v1/leverage';
    const ts = Date.now();

    const params = {
      symbol,
      leverage,
      timestamp: ts,
      recvWindow: 5000,
    };

    const query = signParams(params);
    const res = await fetch(`${BASE_URL}${endpoint}?${query}`, {
      method: 'POST',
      headers: { 'X-MBX-APIKEY': process.env.BINANCE_API_KEY },
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Binance setLeverage error: ${res.status} ${err}`);
    }

    return await res.json();
  } catch (err) {
    logger.error(`❌ setLeverage failed for ${symbol}:`, err.message);
    return null;
  }
}

/* ========= Trades ========= */

export async function getUserTrades(symbol, options = {}) {
  try {
    const res = await client.futuresUserTrades({
      symbol,
      limit: options.limit || 50,
      fromId: options.fromId,
    });

    return res.map((t) => ({
      id: t.id,
      orderId: t.orderId,
      symbol: t.symbol,
      side: t.side,
      price: Number(t.price),
      qty: Number(t.qty),
      realizedPnl: Number(t.realizedPnl),
      marginAsset: t.marginAsset,
      time: t.time,
    }));
  } catch (err) {
    logger.error(`❌ getUserTrades failed for ${symbol}:`, err.message);
    return [];
  }
}

export async function cancelStopOrders(symbol, opts = {}) {
  const { onlySL = false, onlyTP = false } = opts;
  try {
    const res = await client.futuresOpenOrders({ symbol });
    if (!Array.isArray(res)) return;

    for (let o of res) {
      const isSL =
        o.type.includes('STOP') || o.type.includes('TRAILING_STOP_MARKET');
      const isTP = o.type.includes('TAKE_PROFIT');

      // фільтрація
      if (onlySL && !isSL) continue;
      if (onlyTP && !isTP) continue;
      if (!onlySL && !onlyTP && !(isSL || isTP)) continue; // за замовчуванням — тільки SL/TP

      await client.futuresCancelOrder({ symbol, orderId: o.orderId });
      logger.info(`❌ Canceled ${o.type} @ ${symbol} (${o.orderId})`);
    }
  } catch (err) {
    logger.error(`❌ cancelStopOrders failed for ${symbol}:`, err.message);
  }
}
