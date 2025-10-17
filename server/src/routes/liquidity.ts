import express from 'express';
import {
  getLiquidity,
  saveLiquidity,
} from '../controllers/liquidityController.js';

const router = express.Router();

// POST /liquidity - Save a liquidity document
router.post('/', saveLiquidity);

// GET /liquidity - Get liquidity documents
// Query params: symbol (optional), limit (optional, default 100)
router.get('/', getLiquidity);

export default router;
