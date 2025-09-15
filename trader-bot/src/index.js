import { TickerStepWS } from './analytical-steps/ticker-step.js';
import { finalAnalyzer } from './utils/finalAnalyzer.js';
import { OrderBookStepWS } from './analytical-steps/order-book-step.js';

// OrderBookStepWS('ethusdt')
// TickerStepWS('ETHUSDT')

setInterval(
  () => {
    finalAnalyzer();
  },
  5 * 60 * 1000,
);
