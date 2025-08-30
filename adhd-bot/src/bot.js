import 'dotenv/config';
import { Telegraf } from 'telegraf';
import { openDb, closeDb } from './db/sqlite.js';
import { info, error, success } from './logger.js';
import { setupHandlers } from './handlers/index.js';
import { startReminderService } from './services/reminder.js';
import { trackEvent } from './services/analytics.js';

// Validate environment
const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  error('Missing TELEGRAM_BOT_TOKEN in .env file');
  process.exit(1);
}

// Initialize bot
const bot = new Telegraf(token);

// Initialize database
openDb();

// Middleware for logging
bot.use(async (ctx, next) => {
  const start = Date.now();
  
  // Log command/message
  if (ctx.message?.text) {
    info(`User ${ctx.from?.id} (${ctx.from?.username}): ${ctx.message.text}`);
  }
  
  // Track analytics
  if (ctx.from?.id && ctx.message?.text?.startsWith('/')) {
    const command = ctx.message.text.split(' ')[0];
    trackEvent(ctx.from.id, 'command', { command });
  }
  
  await next();
  
  const responseTime = Date.now() - start;
  if (responseTime > 1000) {
    info(`Slow response: ${responseTime}ms`);
  }
});

// Error handling middleware
bot.catch((err, ctx) => {
  error(`Bot error for ${ctx.from?.id}:`, err);
  ctx.reply('❌ Something went wrong. Please try again later.');
});

// Setup all command handlers
setupHandlers(bot);

// Start reminder service if enabled
if (process.env.ENABLE_REMINDERS === 'true') {
  startReminderService(bot);
  info('Reminder service started');
}

// Launch bot
bot.launch()
  .then(() => {
    success(`🤖 ${process.env.BOT_NAME || 'ADHD Bot'} started successfully!`);
    success(`Bot username: @${bot.botInfo?.username}`);
  })
  .catch(err => {
    error('Failed to start bot:', err);
    process.exit(1);
  });

// Graceful shutdown
const shutdown = (signal) => {
  info(`Received ${signal}, shutting down gracefully...`);
  bot.stop(signal);
  closeDb();
  process.exit(0);
};

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));