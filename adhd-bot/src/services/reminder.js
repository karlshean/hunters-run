import cron from 'node-cron';
import { prepare } from '../db/sqlite.js';
import { needsReminder } from '../lib/streaks.js';
import { isTimeToSend } from '../lib/time.js';
import { info, error } from '../logger.js';

// Get users who need reminders
const getUsersForReminder = prepare(`
  SELECT telegram_id, tz, reminder_time 
  FROM users 
  WHERE reminder_enabled = 1
`);

// Get last task for user
const getLastTask = prepare(`
  SELECT text FROM tasks 
  WHERE telegram_id = ? 
  ORDER BY created_at DESC 
  LIMIT 1
`);

/**
 * Send reminder to user
 */
async function sendReminder(bot, telegramId, task) {
  try {
    const taskText = task ? `\n\n📝 Today's task: *${task}*` : '';
    
    const messages = [
      `🌅 Good morning! Time for your daily check-in.${taskText}\n\nUse /done when complete or /skip if needed.`,
      `☀️ Hey there! Ready to tackle today?${taskText}\n\nRemember: Progress > Perfection!`,
      `🎯 Daily reminder: Focus on your ONE thing today.${taskText}\n\nYou've got this! 💪`,
      `⏰ Time to check in!${taskText}\n\nSmall steps lead to big changes.`,
    ];
    
    const message = messages[Math.floor(Math.random() * messages.length)];
    
    await bot.telegram.sendMessage(telegramId, message, { parse_mode: 'Markdown' });
    info(`Reminder sent to user ${telegramId}`);
  } catch (err) {
    error(`Failed to send reminder to ${telegramId}:`, err.message);
  }
}

/**
 * Check and send evening reminders
 */
async function sendEveningReminder(bot, telegramId) {
  try {
    const message = `
🌙 Evening check-in reminder!

Have you completed today's task?
• ✅ Use /done if complete
• ⏭️ Use /skip if you couldn't do it
• 📊 Use /status to see your progress

Remember: Checking in (even skips) helps build awareness!`;
    
    await bot.telegram.sendMessage(telegramId, message, { parse_mode: 'Markdown' });
    info(`Evening reminder sent to user ${telegramId}`);
  } catch (err) {
    error(`Failed to send evening reminder to ${telegramId}:`, err.message);
  }
}

/**
 * Start the reminder service
 */
export function startReminderService(bot) {
  // Run every minute to check for reminders
  const task = cron.schedule('* * * * *', async () => {
    const users = getUsersForReminder.all();
    
    for (const user of users) {
      try {
        // Check if user needs reminder at this time
        if (needsReminder(user.telegram_id, user.tz)) {
          // Morning reminder (default 9 AM)
          if (isTimeToSend(user.reminder_time || '09:00', user.tz)) {
            const lastTask = getLastTask.get(user.telegram_id);
            await sendReminder(bot, user.telegram_id, lastTask?.text);
          }
          
          // Evening reminder (8 PM)
          if (isTimeToSend('20:00', user.tz)) {
            await sendEveningReminder(bot, user.telegram_id);
          }
        }
      } catch (err) {
        error(`Reminder error for user ${user.telegram_id}:`, err.message);
      }
    }
  });
  
  info('Reminder service started (checking every minute)');
  
  return task;
}

/**
 * Stop the reminder service
 */
export function stopReminderService(task) {
  if (task) {
    task.stop();
    info('Reminder service stopped');
  }
}