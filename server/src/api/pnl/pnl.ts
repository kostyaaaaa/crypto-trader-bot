import axios from 'axios';
import crypto from 'crypto';
import { PnLIncomeItem, PnLSummaryResponse } from './pnl.type';

const MAX_LIMIT = 999;

export const getPnL = async (
  daysBack: number = 1,
): Promise<PnLSummaryResponse> => {
  try {
    const { BINANCE_API_KEY, BINANCE_ACCOUNT_SECRET_KEY } = process.env;

    if (!BINANCE_API_KEY || !BINANCE_ACCOUNT_SECRET_KEY) {
      throw new Error('Missing Binance API credentials');
    }

    const now = Date.now();
    // Start of today in UTC
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const startTime = startOfDay.getTime();

    const query = `startTime=${startTime}&endTime=${now}&limit=${MAX_LIMIT}&timestamp=${now}&recvWindow=5000`;
    const signature = crypto
      .createHmac('sha256', BINANCE_ACCOUNT_SECRET_KEY)
      .update(query)
      .digest('hex');

    const url = `https://fapi.binance.com/fapi/v1/income?${query}&signature=${signature}`;

    const res = await axios.get(url, {
      headers: { 'X-MBX-APIKEY': BINANCE_API_KEY },
    });

    const pnl = res.data.reduce(
      (sum: number, i: PnLIncomeItem) => sum + parseFloat(i.income),
      0,
    );

    return {
      daysBack,
      realizedPnL: parseFloat(pnl.toFixed(4)),
      currency: 'USDT',
      data: res.data,
    };
  } catch (err: any) {
    console.error('Error:', err.response?.data || err.message);
    throw err;
  }
};
