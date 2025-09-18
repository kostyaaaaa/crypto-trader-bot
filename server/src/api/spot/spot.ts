import axios from 'axios';
import crypto from 'crypto';
import { SpotAccountResponse } from './spot.type.js';

export const getAccountSpotBalance = async (): Promise<SpotAccountResponse> => {
  try {
    // Environment variables are now properly typed
    const { BINANCE_API_KEY, BINANCE_ACCOUNT_SECRET_KEY } = process.env;

    if (!BINANCE_API_KEY || !BINANCE_ACCOUNT_SECRET_KEY) {
      throw new Error('Missing Binance API credentials');
    }

    const timestamp = Date.now();
    const query = `timestamp=${timestamp}&recvWindow=5000`;

    // generate signature
    const signature = crypto
      .createHmac('sha256', BINANCE_ACCOUNT_SECRET_KEY)
      .update(query)
      .digest('hex');

    // send request
    const url = `https://api.binance.com/api/v3/account?${query}&signature=${signature}`;
    const res = await axios.get(url, {
      headers: { 'X-MBX-APIKEY': BINANCE_API_KEY },
    });

    return res.data;
  } catch (err: any) {
    console.error('Error:', err.response?.data || err.message);
    throw err;
  }
};
