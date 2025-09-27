import express from 'express';
import { getAnalysisByDateRangeAndSymbol } from '../controllers/analyticsController.js';

const router = express.Router();

// GET /analytics - Get analysis data by date range and symbol
// Query params: symbol (required), dateFrom (required, ISO timestamp string), dateTo (required, ISO timestamp string)
// Returns all analysis within the date range
router.get('/', getAnalysisByDateRangeAndSymbol);

export default router;
