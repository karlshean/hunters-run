import { setupTaskHandlers } from './tasks.js';
import { setupCheckinHandlers } from './checkins.js';
import { setupAnalyticsHandlers } from './analytics.js';
import { setupUserHandlers } from './users.js';
import { setupHelpHandlers } from './help.js';

/**
 * Setup all bot command handlers
 */
export function setupHandlers(bot) {
  // Core handlers
  setupUserHandlers(bot);
  setupTaskHandlers(bot);
  setupCheckinHandlers(bot);
  
  // Analytics and reporting
  setupAnalyticsHandlers(bot);
  
  // Help and info
  setupHelpHandlers(bot);
  
  // Fallback for unknown commands
  bot.on('text', (ctx) => {
    if (ctx.message.text.startsWith('/')) {
      ctx.reply("❓ Unknown command. Use /help to see available commands.");
    }
  });
}