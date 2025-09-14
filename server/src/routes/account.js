import express from 'express';
import {
  getSpotBalance,
  getFuturesBalance,
} from '../controllers/accountController.js';

const router = express.Router();

// GET /account/spot/balance
router.get('/spot/balance', getSpotBalance);

// GET /account/futures/balance
router.get('/futures/balance', getFuturesBalance);

export default router;
