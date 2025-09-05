import { Router } from 'express';
import { TelegramController } from '../telegram/telegram.controller';

const router = Router();
const telegramController = new TelegramController();

/**
 * Telegram webhook endpoint
 * POST /api/telegram/webhook
 */
router.post('/webhook', async (req, res) => {
  await telegramController.webhook(req, res);
});

/**
 * Health check for Telegram integration
 * GET /api/telegram/health  
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'telegram-webhook',
    timestamp: new Date().toISOString()
  });
});

export default router;