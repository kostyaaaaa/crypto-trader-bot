import express from 'express';
import {
  getLiquidations,
  saveLiquidations,
} from '../controllers/liquidationsController.js';

const router = express.Router();

// POST /liquidations - Save a liquidations document
router.post('/', saveLiquidations);

// GET /liquidations - Get liquidations documents
// Query params: symbol (optional), limit (optional, default 100)
router.get('/', getLiquidations);

export default router;
