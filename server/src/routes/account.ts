import express from 'express';
import {
  getAccountPnL,
  getFuturesBalance,
} from '../controllers/accountController.js';

const router = express.Router();

// GET /account/futures/balance
router.get('/futures/balance', getFuturesBalance);

// GET /account/pnl?days=1
router.get('/pnl', getAccountPnL);

export default router;
