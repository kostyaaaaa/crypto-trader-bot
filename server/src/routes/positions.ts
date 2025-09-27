import express from 'express';
import { getPositionsByTimeAndSymbol } from '../controllers/positionsController.js';

const router = express.Router();

// GET /positions - Get positions data by time and symbol
// Query params: symbol (required), time (required, timestamp number)
// Returns all positions where openedAt > provided time
router.get('/', getPositionsByTimeAndSymbol);

export default router;
