import axios from 'axios';
import crypto from 'crypto';

export const getAccountFuturesBalance = async () => {
  try {
    const { BINANCE_API_KEY, BINANCE_ACCOUNT_SECRET_KEY } = process.env;

    const timestamp = Date.now();
    const query = `timestamp=${timestamp}&recvWindow=5000`;

    // signature
    const signature = crypto
      .createHmac('sha256', BINANCE_ACCOUNT_SECRET_KEY)
      .update(query)
      .digest('hex');

    const url = `https://fapi.binance.com/fapi/v2/account?${query}&signature=${signature}`;
    const res = await axios.get(url, {
      headers: { 'X-MBX-APIKEY': BINANCE_API_KEY },
    });

    return res.data;
  } catch (err) {
    console.error('Error:', err.response?.data || err.message);
  }
};
