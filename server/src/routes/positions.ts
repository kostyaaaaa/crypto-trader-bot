import express from 'express';
import { getPositionsByDateRangeAndSymbol } from '../controllers/positionsController.js';

const router = express.Router();

// GET /positions - Get closed positions history by date range and symbol
// Query params: symbol (required), dateFrom (required, ISO timestamp string), dateTo (required, ISO timestamp string)
// Returns only CLOSED positions within the timestamp range (history endpoint)
router.get('/', getPositionsByDateRangeAndSymbol);

export default router;
