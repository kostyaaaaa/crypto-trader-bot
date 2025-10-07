import express, { type Request, type Response } from 'express';
import { sendTelegramNotification } from '../services/notificationService.js';
import logger from '../utils/Logger.js';

const router = express.Router();

const TV_SECRET = process.env.TV_SECRET || '';

router.get('/health', (_req: Request, res: Response) =>
  res.status(200).send('ok'),
);

router.post('/tv-webhook', async (req: Request, res: Response) => {
  try {
    const secret =
      (req.headers['x-tv-secret'] as string) || (req.body?.secret as string);
    if (!TV_SECRET || secret !== TV_SECRET) {
      return res.status(403).json({ ok: false, error: 'forbidden' });
    }

    const payload = req.body ?? {};

    logger.info('📩 TV webhook', payload);

    const { event, ticker, interval, price, time, note } = payload as Record<
      string,
      any
    >;
    const msgLines = [
      '🔔 *TradingView Alert*',
      event ? `*Event*: ${event}` : null,
      ticker || interval || price
        ? `*Symbol*: ${ticker ?? ''}  *TF*: ${interval ?? ''}  *Price*: ${price ?? ''}`
        : null,
      time ? `*Time*: ${time}` : null,
      note ? `*Note*: ${note}` : null,
    ].filter(Boolean);
    const text = msgLines.join('\n');
    await sendTelegramNotification(text);

    return res.json({ ok: true });
  } catch (error) {
    logger.error('Webhook error:', error);
    return res.status(500).json({ ok: false });
  }
});

export default router;
