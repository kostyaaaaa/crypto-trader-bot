import axios from 'axios';
import crypto from 'crypto';

export const getPnL = async (daysBack = 1) => {
  try {
    const { BINANCE_API_KEY, BINANCE_ACCOUNT_SECRET_KEY } = process.env;

    const now = Date.now();
    const startTime = now - daysBack * 24 * 60 * 60 * 1000;

    const query = `startTime=${startTime}&endTime=${now}&incomeType=REALIZED_PNL&timestamp=${now}&recvWindow=5000`;
    const signature = crypto
      .createHmac('sha256', BINANCE_ACCOUNT_SECRET_KEY)
      .update(query)
      .digest('hex');

    const url = `https://fapi.binance.com/fapi/v1/income?${query}&signature=${signature}`;

    const res = await axios.get(url, {
      headers: { 'X-MBX-APIKEY': BINANCE_API_KEY },
    });

    const pnl = res.data
      .filter((i) => i.incomeType === 'REALIZED_PNL')
      .reduce((sum, i) => sum + parseFloat(i.income), 0);

    return {
      daysBack,
      realizedPnL: parseFloat(pnl.toFixed(4)),
      currency: 'USDT',
      data: res.data,
    };
  } catch (err) {
    console.error('Error:', err.response?.data || err.message);
    throw err;
  }
};
