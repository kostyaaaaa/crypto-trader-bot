import { Router } from 'express';
import { getCandles, saveCandle } from '../controllers/candlesController.js';

const router = Router();

// GET /candles - отримати свічки
router.get('/', getCandles);

// POST /candles - зберегти свічку
router.post('/', saveCandle);

export default router;
