// open-interest-step.js
// --- Збирає Open Interest (OI) та ціну з Binance ---
// Джерела даних:
//   1) /futures/data/openInterestHist → Open Interest
//   2) /fapi/v1/ticker/price → поточна ціна
//
// Мета: збирати історію OI + Price для подальшого аналізу (analyzeOpenInterest)

import axios from 'axios';
import { saveDoc } from '../../storage/storage.js';

export async function OpenInterestStep(symbol = 'ETHUSDT') {
  try {
    // 1. Запит до Binance Futures: історія Open Interest
    const res = await axios.get(
      'https://fapi.binance.com/futures/data/openInterestHist',
      {
        params: {
          symbol, // тикер (ETHUSDT, BTCUSDT, ...)
          period: '5m', // агрегація по 5 хвилин
          limit: 1, // беремо тільки останній запис
        },
      },
    );

    if (!res.data || !res.data.length) {
      console.log('⚠️ No OI data');
      return null;
    }

    const last = res.data[res.data.length - 1];

    // 2. Запит до Binance Futures: поточна ринкова ціна
    const priceRes = await axios.get(
      'https://fapi.binance.com/fapi/v1/ticker/price',
      { params: { symbol } },
    );

    const price = parseFloat(priceRes.data.price);

    // 3. Формуємо "свічку" (одна точка історії)
    const candle = {
      symbol,
      time: new Date(last.timestamp).toISOString(), // час у ISO
      price, // поточна ціна
      openInterest: parseFloat(last.sumOpenInterest), // кількість контрактів
      openInterestValue: parseFloat(last.sumOpenInterestValue), // USD-еквівалент
    };

    // 4. Зберігаємо у storage (файл або Mongo)
    await saveDoc('openinterest', candle);

    return candle;
  } catch (err) {
    console.error('❌ OI fetch error:', err.message);
    return null;
  }
}
