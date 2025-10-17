import express from 'express';
import accountRouter from './account.js';
import analyticsRouter from './analytics.js';
import coinConfigRouter from './coinConfig.js';
import liquidationsRouter from './liquidations.js';
import liquidityRouter from './liquidity.js';
import positionsRouter from './positions.js';
import tvWebhookRouter from './tvWebhook.js';

const router = express.Router();

// Mount account routes
router.use('/account', accountRouter);

// Mount coin config routes
router.use('/coinconfig', coinConfigRouter);

// Mount analytics routes
router.use('/analytics', analyticsRouter);

// Mount positions routes
router.use('/positions', positionsRouter);

// Mount liquidations routes
router.use('/liquidations', liquidationsRouter);

// Mount liquidity routes
router.use('/liquidity', liquidityRouter);

// Mount TV webhook routes
router.use('/', tvWebhookRouter);

export default router;
