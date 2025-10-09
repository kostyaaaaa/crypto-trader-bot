import crypto from 'crypto';
import logger from '../../../utils/db-logger.ts';
const BASE_URL = 'https://fapi.binance.com';

function signParams(params: Record<string, string | number>): string {
  const query = new URLSearchParams(params as any).toString();
  const signature = crypto
    .createHmac('sha256', String(process.env.BINANCE_ACCOUNT_SECRET_KEY))
    .update(query)
    .digest('hex');
  return `${query}&signature=${signature}`;
}

export async function setLeverage(
  symbol: string,
  leverage: number,
): Promise<any | null> {
  try {
    const endpoint = '/fapi/v1/leverage';
    const ts = Date.now();

    const params = { symbol, leverage, timestamp: ts, recvWindow: 5000 };
    const query = signParams(params);

    const res = await fetch(`${BASE_URL}${endpoint}?${query}`, {
      method: 'POST',
      headers: { 'X-MBX-APIKEY': String(process.env.BINANCE_API_KEY) },
    });

    if (!res.ok) {
      const errTxt = await res.text();
      throw new Error(`Binance setLeverage error: ${res.status} ${errTxt}`);
    }
    return await res.json();
  } catch (err: any) {
    logger.error(`❌ setLeverage failed for ${symbol}:`, err?.message || err);
    return null;
  }
}
