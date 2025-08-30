import { prepare } from '../db/sqlite.js';
import { todayInTz } from '../lib/time.js';
import { applyDone, applyMiss, getStreakMessage, getMotivationalMessage } from '../lib/streaks.js';
import { info } from '../logger.js';

// Prepared statements
const getUser = prepare(`SELECT * FROM users WHERE telegram_id = ?`);
const getLastTask = prepare(`
  SELECT * FROM tasks 
  WHERE telegram_id = ? 
  ORDER BY created_at DESC 
  LIMIT 1
`);

const getCheckin = prepare(`
  SELECT * FROM checkins 
  WHERE telegram_id = ? AND date = ?
`);

const upsertCheckin = prepare(`
  INSERT INTO checkins (telegram_id, date, status, task_id, task_text, notes, mood, energy)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(telegram_id, date) DO UPDATE SET
    status = excluded.status,
    task_id = excluded.task_id,
    task_text = excluded.task_text,
    notes = excluded.notes,
    mood = excluded.mood,
    energy = excluded.energy,
    created_at = datetime('now')
`);

const updateTaskCompletion = prepare(`
  UPDATE tasks 
  SET completed_at = datetime('now')
  WHERE id = ? AND completed_at IS NULL
`);

/**
 * Setup check-in related command handlers
 */
export function setupCheckinHandlers(bot) {
  // Mark task as done
  bot.command('done', async (ctx) => {
    const user = getUser.get(ctx.from.id);
    if (!user) {
      return ctx.reply('❌ Please use /start first');
    }
    
    const task = getLastTask.get(ctx.from.id);
    const today = todayInTz(user.tz);
    
    // Check if already checked in today
    const existingCheckin = getCheckin.get(ctx.from.id, today);
    if (existingCheckin && existingCheckin.status === 'done') {
      return ctx.reply('✅ You already checked in today! Great job maintaining consistency!');
    }
    
    // Record check-in
    upsertCheckin.run(
      ctx.from.id,
      today,
      'done',
      task?.id || null,
      task?.text || 'Daily task',
      null, // notes
      null, // mood
      null  // energy
    );
    
    // Mark task as completed if exists
    if (task && !task.completed_at) {
      updateTaskCompletion.run(task.id);
    }
    
    // Update streak
    const streak = applyDone(ctx.from.id, today);
    
    info(`User ${ctx.from.id} marked task as done`);
    
    const motivational = getMotivationalMessage(streak);
    
    const response = `
✅ **Task Completed!**

${task ? `📝 ${task.text}` : 'Daily task'}

${getStreakMessage(streak)}

${motivational}`;
    
    return ctx.reply(response, { parse_mode: 'Markdown' });
  });
  
  // Skip task
  bot.command('skip', async (ctx) => {
    const user = getUser.get(ctx.from.id);
    if (!user) {
      return ctx.reply('❌ Please use /start first');
    }
    
    const task = getLastTask.get(ctx.from.id);
    const today = todayInTz(user.tz);
    
    // Check if already checked in today
    const existingCheckin = getCheckin.get(ctx.from.id, today);
    if (existingCheckin) {
      return ctx.reply('📝 You already checked in today');
    }
    
    // Record skip
    upsertCheckin.run(
      ctx.from.id,
      today,
      'skip',
      task?.id || null,
      task?.text || null,
      null, // notes
      null, // mood
      null  // energy
    );
    
    // Update streak (reset)
    const streak = applyMiss(ctx.from.id, today);
    
    info(`User ${ctx.from.id} skipped task`);
    
    const response = `
⏭️ **Task Skipped**

That's okay! Tomorrow is a fresh start.

${getStreakMessage(streak)}

💡 **Tip:** Consistency is more important than perfection. Try to get back on track tomorrow!`;
    
    return ctx.reply(response, { parse_mode: 'Markdown' });
  });
  
  // Check-in with mood
  bot.command('checkin', async (ctx) => {
    const parts = ctx.message.text.split(/\s+/);
    const mood = parseInt(parts[1]);
    const energy = parseInt(parts[2]);
    
    if (!mood || mood < 1 || mood > 5) {
      return ctx.reply(`
📊 **Detailed Check-in**

Usage: \`/checkin <mood> <energy>\`

Rate from 1-5:
• Mood: 😔 1 - 2 - 3 - 4 - 5 😊
• Energy: 😴 1 - 2 - 3 - 4 - 5 ⚡

Example: \`/checkin 4 3\`

This helps track patterns over time!`, 
        { parse_mode: 'Markdown' }
      );
    }
    
    const user = getUser.get(ctx.from.id);
    if (!user) {
      return ctx.reply('❌ Please use /start first');
    }
    
    const task = getLastTask.get(ctx.from.id);
    const today = todayInTz(user.tz);
    
    // Update existing check-in with mood/energy
    const existingCheckin = getCheckin.get(ctx.from.id, today);
    if (!existingCheckin) {
      return ctx.reply('❌ Please use /done or /skip first, then add mood/energy');
    }
    
    upsertCheckin.run(
      ctx.from.id,
      today,
      existingCheckin.status,
      existingCheckin.task_id,
      existingCheckin.task_text,
      existingCheckin.notes,
      mood,
      energy || null
    );
    
    const moodEmojis = ['😔', '😕', '😐', '🙂', '😊'];
    const energyEmojis = ['😴', '🔋', '⚡', '💪', '🚀'];
    
    const response = `
📊 **Check-in Updated**

Mood: ${moodEmojis[mood - 1]} (${mood}/5)
${energy ? `Energy: ${energyEmojis[energy - 1]} (${energy}/5)` : ''}

Thanks for tracking! This data helps identify patterns.`;
    
    return ctx.reply(response, { parse_mode: 'Markdown' });
  });
  
  // Add notes to check-in
  bot.command('note', async (ctx) => {
    const note = ctx.message.text.replace(/^\/note\s*/i, '').trim();
    
    if (!note) {
      return ctx.reply(`
📝 **Add Notes**

Usage: \`/note <your thoughts>\`

Example: \`/note Had trouble focusing in the morning, better after coffee\`

Notes help you identify patterns and triggers!`, 
        { parse_mode: 'Markdown' }
      );
    }
    
    const user = getUser.get(ctx.from.id);
    if (!user) {
      return ctx.reply('❌ Please use /start first');
    }
    
    const today = todayInTz(user.tz);
    const existingCheckin = getCheckin.get(ctx.from.id, today);
    
    if (!existingCheckin) {
      return ctx.reply('❌ Please complete today\'s check-in first with /done or /skip');
    }
    
    upsertCheckin.run(
      ctx.from.id,
      today,
      existingCheckin.status,
      existingCheckin.task_id,
      existingCheckin.task_text,
      note,
      existingCheckin.mood,
      existingCheckin.energy
    );
    
    return ctx.reply('📝 Note added to today\'s check-in');
  });
}