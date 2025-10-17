import express from 'express';
import {
  getAnalysis,
  saveAnalysis,
} from '../controllers/analyticsController.js';

const router = express.Router();

// POST /analytics - Save an analysis document
router.post('/', saveAnalysis);

// GET /analytics - Get analysis documents
// Query params:
//   - symbol (optional): Filter by symbol
//   - limit (optional, default 100): Limit number of results (ignored if dateFrom/dateTo provided)
//   - dateFrom (optional): ISO timestamp string - start of date range
//   - dateTo (optional): ISO timestamp string - end of date range
// If dateFrom and dateTo are provided, returns all analysis within the date range
// Otherwise, returns the most recent N documents based on limit
router.get('/', getAnalysis);

export default router;
