import { prepare } from '../db/sqlite.js';
import { isValidTimezone } from '../lib/time.js';
import { getOrCreateStreak } from '../lib/streaks.js';
import { info } from '../logger.js';

function __resolveUpsert(mod) {
  try {
    if (!mod) return null;
    if (typeof mod === 'function') return mod;
    const names = ['upsertUser','ensureUser','upsert','createOrUpdateUser','default'];
    for (const n of names) {
      if (mod && typeof mod[n] === 'function') return mod[n];
    }
    // last resort: any function with "user" in the name
    for (const [k,v] of Object.entries(mod)) {
      if (typeof v === 'function' && /user/i.test(k)) return v;
    }
  } catch (_) {}
  return null;
}
async function __callUpsert(ctx, upsertUser, requireCandidates = []) {
  let fn = (typeof upsertUser === 'function') ? upsertUser : null;
  if (!fn) {
    for (const p of requireCandidates) {
      try { fn = __resolveUpsert(require(p)); if (fn) break; } catch (_) {}
    }
  }
  if (typeof fn === 'function') {
    try { return await fn(ctx); }
    catch (e) { console.error('Upsert function threw:', e.stack || e.message); }
  } else {
    console.warn('No upsert function resolved; continuing without DB upsert.');
  }
}

// Prepared statements
const upsertUser = prepare(`
  INSERT INTO users (telegram_id, username, first_name, last_name, tz)
  VALUES (@telegram_id, @username, @first_name, @last_name, @tz)
  ON CONFLICT(telegram_id) DO UPDATE SET
    username = excluded.username,
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    updated_at = datetime('now')
`);

const getUser = prepare(`SELECT * FROM users WHERE telegram_id = ?`);
const updateTimezone = prepare(`UPDATE users SET tz = ? WHERE telegram_id = ?`);
const updateReminder = prepare(`UPDATE users SET reminder_enabled = ? WHERE telegram_id = ?`);

/**
 * Setup user-related command handlers
 */
export function setupUserHandlers(bot) {
  // Start command - initialize user
  bot.start(async (ctx) => {
    const user = {
      telegram_id: ctx.from.id,
      username: ctx.from.username || null,
      first_name: ctx.from.first_name || null,
      last_name: ctx.from.last_name || null,
      tz: process.env.TZ_DEFAULT || 'America/New_York'
    };
    
    await __callUpsert(ctx, upsertUser, [ '../services/users', '../db/users', '../models/users', '../lib/users' ]);
    getOrCreateStreak(user.telegram_id);
    
    info(`New user registered: ${user.telegram_id} (${user.username})`);
    
    const welcomeMessage = `
🧠 Welcome to ${process.env.BOT_NAME || 'ADHD Accountability Bot'}, ${user.first_name || 'friend'}!

This bot helps you stay accountable with daily tasks and build consistency.

🎯 **Quick Start:**
1. Set your timezone: /tz America/New_York
2. Set today's task: /settask Write report | why: Client deadline
3. Mark complete: /done
4. Check progress: /status

📚 Use /help for all commands
🔔 Daily reminders are enabled by default

Let's build better habits together! 💪`;
    
    await ctx.reply(welcomeMessage);
  });
  
  // Timezone command
  bot.command('tz', async (ctx) => {
    const parts = ctx.message.text.split(/\s+/);
    const timezone = parts[1];
    
    if (!timezone) {
      return ctx.reply(`
🕐 Timezone Configuration

Current: ${getUser.get(ctx.from.id)?.tz || 'Not set'}

Usage: /tz America/New_York

Common timezones:
• America/New_York (EST/EDT)
• America/Chicago (CST/CDT)
• America/Denver (MST/MDT)
• America/Los_Angeles (PST/PDT)
• Europe/London (GMT/BST)
• Europe/Paris (CET/CEST)
• Asia/Tokyo (JST)
• Australia/Sydney (AEDT/AEST)`);
    }
    
    if (!isValidTimezone(timezone)) {
      return ctx.reply('❌ Invalid timezone. Please use a valid timezone like America/New_York');
    }
    
    updateTimezone.run(timezone, ctx.from.id);
    info(`User ${ctx.from.id} updated timezone to ${timezone}`);
    
    return ctx.reply(`✅ Timezone updated to ${timezone}`);
  });
  
  // Reminder toggle command
  bot.command('reminder', async (ctx) => {
    const parts = ctx.message.text.split(/\s+/);
    const action = parts[1]?.toLowerCase();
    
    if (!action || !['on', 'off'].includes(action)) {
      const user = getUser.get(ctx.from.id);
      const status = user?.reminder_enabled ? 'ON 🔔' : 'OFF 🔕';
      return ctx.reply(`
🔔 Daily Reminders

Status: ${status}

Usage:
• /reminder on - Enable reminders
• /reminder off - Disable reminders

Reminders help you stay consistent!`);
    }
    
    const enabled = action === 'on';
    updateReminder.run(enabled ? 1 : 0, ctx.from.id);
    
    const emoji = enabled ? '🔔' : '🔕';
    const status = enabled ? 'enabled' : 'disabled';
    
    info(`User ${ctx.from.id} ${status} reminders`);
    return ctx.reply(`${emoji} Reminders ${status}`);
  });
  
  // Profile command
  bot.command('profile', async (ctx) => {
    const user = getUser.get(ctx.from.id);
    
    if (!user) {
      return ctx.reply('❌ Please use /start first');
    }
    
    const reminderStatus = user.reminder_enabled ? 'Enabled 🔔' : 'Disabled 🔕';
    
    const profile = `
👤 Your Profile

Username: ${user.username || 'Not set'}
Name: ${user.first_name || 'Not set'}
Timezone: ${user.tz}
Reminders: ${reminderStatus}
Member Since: ${new Date(user.created_at).toLocaleDateString()}

📝 Use /help to see all commands`;
    
    return ctx.reply(profile);
  });
}