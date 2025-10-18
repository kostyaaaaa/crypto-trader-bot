import { Router } from 'express';
import {
  getCandles,
  saveCandle,
  saveCandlesBatch,
} from '../controllers/candlesController.js';

const router = Router();

// GET /candles - отримати свічки
router.get('/', getCandles);

// POST /candles - зберегти одну свічку
router.post('/', saveCandle);

// POST /candles/batch - зберегти багато свічок одразу
router.post('/batch', saveCandlesBatch);

export default router;
