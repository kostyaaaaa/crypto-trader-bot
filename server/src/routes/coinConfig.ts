import express from 'express';
import {
  createCoinConfig,
  getAllCoinConfigs,
  getCoinConfigBySymbol,
  updateCoinConfig,
  deleteCoinConfig,
} from '../controllers/coinConfigController.js';

const router = express.Router();

// GET /coinconfig - Get all coin configurations
router.get('/', getAllCoinConfigs);

// GET /coinconfig/:symbol - Get specific coin configuration by symbol
router.get('/:symbol', getCoinConfigBySymbol);

// POST /coinconfig - Create new coin configuration
router.post('/', createCoinConfig);

// PUT /coinconfig/:symbol - Update existing coin configuration
router.put('/:symbol', updateCoinConfig);

// DELETE /coinconfig/:symbol - Delete coin configuration
router.delete('/:symbol', deleteCoinConfig);

export default router;
