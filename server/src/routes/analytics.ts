import express from 'express';
import {
  getAnalysis,
  getAnalysisByDateRangeAndSymbol,
  saveAnalysis,
} from '../controllers/analyticsController.js';

const router = express.Router();

// POST /analytics - Save an analysis document
router.post('/', saveAnalysis);

// GET /analytics - Get analysis documents
// Query params: symbol (optional), limit (optional, default 100)
router.get('/', getAnalysis);

// GET /analytics/history - Get analysis data by date range and symbol
// Query params: symbol (required), dateFrom (required, ISO timestamp string), dateTo (required, ISO timestamp string)
// Returns all analysis within the date range
router.get('/history', getAnalysisByDateRangeAndSymbol);

export default router;
