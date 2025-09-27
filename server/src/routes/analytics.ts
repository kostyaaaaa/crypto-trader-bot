import express from 'express';
import { getAnalysisByTimeAndSymbol } from '../controllers/analyticsController.js';

const router = express.Router();

// GET /analytics - Get analysis data by time and symbol
// Query params: symbol (required), time (required, ISO date string)
// Returns all analysis where time > provided time
router.get('/', getAnalysisByTimeAndSymbol);

export default router;
