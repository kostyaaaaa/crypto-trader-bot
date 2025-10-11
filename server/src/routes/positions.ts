import express from 'express';
import {
  closePosition,
  getPositions,
  getPositionsByDateRangeAndSymbol,
  savePosition,
  updatePosition,
} from '../controllers/positionsController.js';

const router = express.Router();

// POST /positions - Save a position document
router.post('/', savePosition);

// GET /positions - Get position documents
// Query params: symbol (optional), limit (optional, default 100)
router.get('/', getPositions);

// PATCH /positions/:id - Update a position document
// Body: any fields to update (e.g., { adjustments, stopPrice, takeProfits, status, closedAt, closedBy, finalPnl })
router.patch('/:id', updatePosition);

// GET /positions/history - Get closed positions history by date range and symbol
// Query params: symbol (optional), dateFrom (required, ISO timestamp string), dateTo (required, ISO timestamp string)
// Returns only CLOSED positions within the timestamp range (history endpoint)
router.get('/history', getPositionsByDateRangeAndSymbol);

// POST /positions/close - Close a position
router.post('/close', closePosition);

export default router;
