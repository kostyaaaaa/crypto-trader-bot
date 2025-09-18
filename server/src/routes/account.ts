import express from 'express';
import {
  getSpotBalance,
  getFuturesBalance,
  getAccountPnL,
} from '../controllers/accountController.js';

const router = express.Router();

// GET /account/spot/balance
router.get('/spot/balance', getSpotBalance);

// GET /account/futures/balance
router.get('/futures/balance', getFuturesBalance);

// GET /account/pnl?days=1
router.get('/pnl', getAccountPnL);

export default router;
