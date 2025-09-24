// exchanges/binance.js
import pkg from 'binance-api-node';
import crypto from 'crypto';
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
  const info = await client.futuresExchangeInfo();
  const sym = info.symbols.find((s) => s.symbol === symbol);
  return sym?.filters || [];
}

export async function getSymbolInfo(symbol) {
  const info = await client.futuresExchangeInfo();
  return info.symbols.find((s) => s.symbol === symbol) || null;
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
  const priceFilter = symbolFilters.find((f) => f.filterType === 'PRICE_FILTER');
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
  const balances = await client.futuresAccountBalance();
  return balances.find((b) => b.asset === asset)?.balance || 0;
}

export async function getPosition(symbol) {
  const positions = await client.futuresPositionRisk();
  return positions.find((p) => p.symbol === symbol) || null;
}

export async function getOpenOrders(symbol) {
  return await client.futuresOpenOrders({ symbol });
}

/* ========= Orders ========= */

export async function openMarketOrder(symbol, side, quantity) {
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
}

/**
 * Place STOP LOSS order
 */
export async function placeStopLoss(symbol, positionSide, stopPrice, quantity) {
  const filters = await getSymbolFilters(symbol);
  const closeSide = oppositeOrderSide(positionSide);
  const qty = adjustQuantity(filters, quantity);
  const price = adjustPrice(filters, stopPrice);

  if (!qty || Number(qty) <= 0) throw new Error(`SL qty too small for ${symbol}`);
  if (!price || Number(price) <= 0) throw new Error(`SL price invalid for ${symbol}`);

  return await client.futuresOrder({
    symbol,
    side: closeSide,
    type: 'STOP_MARKET',
    stopPrice: price,
    quantity: qty,
    reduceOnly: true,
    // workingType: 'MARK_PRICE',
  });
}

export async function placeTakeProfit(symbol, positionSide, tpPrice, quantity) {
  const filters = await getSymbolFilters(symbol);
  const closeSide = oppositeOrderSide(positionSide);
  const qty = adjustQuantity(filters, quantity);
  const price = adjustPrice(filters, tpPrice);

  if (!qty || Number(qty) <= 0) throw new Error(`TP qty too small for ${symbol}`);
  if (!price || Number(price) <= 0) throw new Error(`TP price invalid for ${symbol}`);

  return await client.futuresOrder({
    symbol,
    side: closeSide,
    type: 'TAKE_PROFIT_MARKET',
    stopPrice: price,
    quantity: qty,
    reduceOnly: true,
    // workingType: 'MARK_PRICE',
  });
}

export async function closePosition(symbol, side, quantity) {
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
}

/* ========= Queries / maintenance ========= */

export async function getOpenPositions() {
  return await client.futuresPositionRisk();
}

export async function cancelAllOrders(symbol) {
  return await client.futuresCancelAllOpenOrders({ symbol });
}

/* ========= Sync helpers ========= */

/**
 * Get current live state for a symbol from Binance
 * - position: side, size, entryPrice
 * - orders: active SL/TP
 */

export async function getLiveState(symbol) {
  // 1. Позиція
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

  // 2. Ордери
  const openOrders = await client.futuresOpenOrders({ symbol });
  const orders = openOrders
      .map((o) => {
        const qty = parseFloat(o.origQty);
        const stopPrice = parseFloat(o.stopPrice);
        const type =
            o.type.includes('STOP') ? 'SL' :
                o.type.includes('TAKE_PROFIT') ? 'TP' :
                    'OTHER';

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
}
function signParams(params) {
  const query = new URLSearchParams(params).toString();
  const signature = crypto
      .createHmac('sha256', process.env.BINANCE_ACCOUNT_SECRET_KEY)
      .update(query)
      .digest('hex');
  return `${query}&signature=${signature}`;
}

/**
 * Виставляє плече для символу
 */
export async function setLeverage(symbol, leverage) {
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
    headers: {
      'X-MBX-APIKEY': process.env.BINANCE_API_KEY,
    },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Binance setLeverage error: ${res.status} ${err}`);
  }

  return await res.json();
}
export async function getUserTrades(symbol, options = {}) {
  try {
    const res = await client.futuresUserTrades({
      symbol,
      limit: options.limit || 50,
      fromId: options.fromId,
    });

    // Нормалізація під твій стиль
    return res.map(t => ({
      id: t.id,
      orderId: t.orderId,
      symbol: t.symbol,
      side: t.side, // BUY / SELL
      price: Number(t.price),
      qty: Number(t.qty),
      realizedPnl: Number(t.realizedPnl),
      marginAsset: t.marginAsset,
      time: t.time,
    }));
  } catch (err) {
    console.error(`❌ getUserTrades failed for ${symbol}:`, err?.message || err);
    return [];
  }
}
export async function cancelStopOrders(symbol) {
  try {
    const res = await client.futuresOpenOrders({ symbol });
    if (!Array.isArray(res)) return;

    const stopOrders = res.filter(o =>
        o.type.includes('STOP') || o.type.includes('TRAILING_STOP_MARKET')
    );

    for (let o of stopOrders) {
      await client.futuresCancelOrder({ symbol, orderId: o.orderId });
      console.log(`❌ Canceled stop order ${o.type} @ ${symbol} (${o.orderId})`);
    }
  } catch (err) {
    console.error(`❌ Failed to cancel stop orders for ${symbol}:`, err.message);
  }
}