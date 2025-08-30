import { prepare } from '../db/sqlite.js';
import { getOrCreateStreak, calculateSuccessRate } from '../lib/streaks.js';
import { getDateRange, formatDate, getWeekday } from '../lib/time.js';

// Prepared statements
const getUser = prepare(`SELECT * FROM users WHERE telegram_id = ?`);

const getRecentCheckins = prepare(`
  SELECT date, status, task_text, mood, energy, notes
  FROM checkins
  WHERE telegram_id = ? AND date >= ?
  ORDER BY date DESC
`);

const getCheckinsCount = prepare(`
  SELECT 
    COUNT(*) as total,
    SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done,
    SUM(CASE WHEN status = 'skip' THEN 1 ELSE 0 END) as skipped,
    AVG(mood) as avg_mood,
    AVG(energy) as avg_energy
  FROM checkins
  WHERE telegram_id = ? AND date >= ?
`);

const getCategoryStats = prepare(`
  SELECT 
    category,
    COUNT(*) as count,
    SUM(CASE WHEN completed_at IS NOT NULL THEN 1 ELSE 0 END) as completed
  FROM tasks
  WHERE telegram_id = ? AND created_at >= datetime('now', '-30 days')
  GROUP BY category
`);

/**
 * Generate status chart
 */
function generateChart(checkins) {
  const chart = checkins.map(c => {
    if (c.status === 'done') return '✅';
    if (c.status === 'skip') return '⏭️';
    return '❌';
  }).reverse().join('');
  
  return chart || 'No data';
}

/**
 * Setup analytics command handlers
 */
export function setupAnalyticsHandlers(bot) {
  // Status command - current streak and today's status
  bot.command('status', async (ctx) => {
    const user = getUser.get(ctx.from.id);
    if (!user) {
      return ctx.reply('❌ Please use /start first');
    }
    
    const streak = getOrCreateStreak(ctx.from.id);
    const successRate = calculateSuccessRate(ctx.from.id);
    
    // Get today's check-in
    const { end } = getDateRange(1, user.tz);
    const todayCheckin = prepare(`
      SELECT * FROM checkins 
      WHERE telegram_id = ? AND date = ?
    `).get(ctx.from.id, end);
    
    let todayStatus = 'Not checked in yet';
    if (todayCheckin) {
      const statusEmojis = {
        done: '✅ Completed',
        skip: '⏭️ Skipped',
        miss: '❌ Missed'
      };
      todayStatus = statusEmojis[todayCheckin.status];
      if (todayCheckin.task_text) {
        todayStatus += ` - ${todayCheckin.task_text}`;
      }
    }
    
    const response = `
📊 **Your Status**

**Today:** ${todayStatus}

🔥 **Current Streak:** ${streak.current} days
🏆 **Best Streak:** ${streak.best} days
📈 **Success Rate:** ${successRate}%
📝 **Total Check-ins:** ${streak.total_checkins}

${!todayCheckin ? '💡 Use /done or /skip to check in today!' : ''}`;
    
    return ctx.reply(response, { parse_mode: 'Markdown' });
  });
  
  // Week view
  bot.command('week', async (ctx) => {
    const user = getUser.get(ctx.from.id);
    if (!user) {
      return ctx.reply('❌ Please use /start first');
    }
    
    const { start } = getDateRange(7, user.tz);
    const checkins = getRecentCheckins.all(ctx.from.id, start);
    const stats = getCheckinsCount.get(ctx.from.id, start);
    
    const chart = generateChart(checkins);
    
    let response = `
📅 **Last 7 Days**

${chart}

✅ Completed: ${stats.done || 0}
⏭️ Skipped: ${stats.skipped || 0}
📊 Success Rate: ${stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0}%`;
    
    if (stats.avg_mood) {
      response += `\n😊 Avg Mood: ${stats.avg_mood.toFixed(1)}/5`;
    }
    if (stats.avg_energy) {
      response += `\n⚡ Avg Energy: ${stats.avg_energy.toFixed(1)}/5`;
    }
    
    // Add daily breakdown
    if (checkins.length > 0) {
      response += '\n\n**Daily Breakdown:**\n';
      checkins.slice(0, 7).forEach(c => {
        const date = formatDate(c.date, user.tz, 'MMM D');
        const day = getWeekday(c.date, user.tz);
        const status = c.status === 'done' ? '✅' : '⏭️';
        response += `${status} ${date} (${day})`;
        if (c.task_text) response += `: ${c.task_text.substring(0, 30)}`;
        response += '\n';
      });
    }
    
    return ctx.reply(response, { parse_mode: 'Markdown' });
  });
  
  // Month view
  bot.command('month', async (ctx) => {
    const user = getUser.get(ctx.from.id);
    if (!user) {
      return ctx.reply('❌ Please use /start first');
    }
    
    const { start } = getDateRange(30, user.tz);
    const checkins = getRecentCheckins.all(ctx.from.id, start);
    const stats = getCheckinsCount.get(ctx.from.id, start);
    
    // Group by week
    const weeks = [];
    for (let i = 0; i < checkins.length; i += 7) {
      weeks.push(checkins.slice(i, i + 7));
    }
    
    let response = `
📊 **Last 30 Days**

✅ Completed: ${stats.done || 0}
⏭️ Skipped: ${stats.skipped || 0}
📈 Success Rate: ${stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0}%
📝 Total Check-ins: ${stats.total || 0}`;
    
    if (stats.avg_mood) {
      response += `\n😊 Avg Mood: ${stats.avg_mood.toFixed(1)}/5`;
    }
    if (stats.avg_energy) {
      response += `\n⚡ Avg Energy: ${stats.avg_energy.toFixed(1)}/5`;
    }
    
    // Weekly charts
    response += '\n\n**Weekly Progress:**\n';
    weeks.forEach((week, index) => {
      if (week.length > 0) {
        const chart = generateChart(week);
        response += `Week ${weeks.length - index}: ${chart}\n`;
      }
    });
    
    return ctx.reply(response, { parse_mode: 'Markdown' });
  });
  
  // Detailed statistics
  bot.command('stats', async (ctx) => {
    const user = getUser.get(ctx.from.id);
    if (!user) {
      return ctx.reply('❌ Please use /start first');
    }
    
    const streak = getOrCreateStreak(ctx.from.id);
    const successRate = calculateSuccessRate(ctx.from.id);
    
    // All-time stats
    const allTimeStats = prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done,
        SUM(CASE WHEN status = 'skip' THEN 1 ELSE 0 END) as skipped,
        AVG(mood) as avg_mood,
        AVG(energy) as avg_energy
      FROM checkins
      WHERE telegram_id = ?
    `).get(ctx.from.id);
    
    // Category stats
    const categories = getCategoryStats.all(ctx.from.id);
    
    // Day of week patterns
    const dayPatterns = prepare(`
      SELECT 
        CASE strftime('%w', date)
          WHEN '0' THEN 'Sunday'
          WHEN '1' THEN 'Monday'
          WHEN '2' THEN 'Tuesday'
          WHEN '3' THEN 'Wednesday'
          WHEN '4' THEN 'Thursday'
          WHEN '5' THEN 'Friday'
          WHEN '6' THEN 'Saturday'
        END as day,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done
      FROM checkins
      WHERE telegram_id = ?
      GROUP BY strftime('%w', date)
      ORDER BY strftime('%w', date)
    `).all(ctx.from.id);
    
    let response = `
📈 **Detailed Statistics**

**🏆 Achievements:**
• Current Streak: ${streak.current} days
• Best Streak: ${streak.best} days
• Success Rate: ${successRate}%
• Total Days: ${allTimeStats.total || 0}

**📊 All-Time Performance:**
• ✅ Completed: ${allTimeStats.done || 0}
• ⏭️ Skipped: ${allTimeStats.skipped || 0}`;
    
    if (allTimeStats.avg_mood) {
      response += `\n• 😊 Avg Mood: ${allTimeStats.avg_mood.toFixed(1)}/5`;
    }
    if (allTimeStats.avg_energy) {
      response += `\n• ⚡ Avg Energy: ${allTimeStats.avg_energy.toFixed(1)}/5`;
    }
    
    // Day patterns
    if (dayPatterns.length > 0) {
      response += '\n\n**📅 Best Days:**\n';
      const sortedDays = dayPatterns
        .filter(d => d.total > 0)
        .sort((a, b) => (b.done / b.total) - (a.done / a.total))
        .slice(0, 3);
      
      sortedDays.forEach(d => {
        const rate = Math.round((d.done / d.total) * 100);
        response += `• ${d.day}: ${rate}% success\n`;
      });
    }
    
    // Categories
    if (categories.length > 0) {
      response += '\n**📁 Categories:**\n';
      categories.forEach(cat => {
        const rate = cat.count > 0 ? Math.round((cat.completed / cat.count) * 100) : 0;
        response += `• ${cat.category || 'Uncategorized'}: ${cat.completed}/${cat.count} (${rate}%)\n`;
      });
    }
    
    return ctx.reply(response, { parse_mode: 'Markdown' });
  });
}