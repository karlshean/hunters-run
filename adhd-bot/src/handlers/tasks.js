import { prepare } from '../db/sqlite.js';
import { info } from '../logger.js';

// Prepared statements
const addTask = prepare(`
  INSERT INTO tasks (telegram_id, text, why, category, difficulty)
  VALUES (?, ?, ?, ?, ?)
`);

const getLastTask = prepare(`
  SELECT * FROM tasks 
  WHERE telegram_id = ? 
  ORDER BY created_at DESC 
  LIMIT 1
`);

const getTodaysTasks = prepare(`
  SELECT * FROM tasks
  WHERE telegram_id = ?
    AND date(created_at) = date('now')
  ORDER BY created_at DESC
`);

const updateTaskCompletion = prepare(`
  UPDATE tasks 
  SET completed_at = datetime('now')
  WHERE id = ?
`);

/**
 * Parse task input
 */
function parseTaskInput(input) {
  // Format: task text | why: reason | cat: category | diff: difficulty
  const parts = input.split('|').map(p => p.trim());
  
  const task = {
    text: parts[0] || '',
    why: null,
    category: null,
    difficulty: 'medium'
  };
  
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    
    if (part.toLowerCase().startsWith('why:')) {
      task.why = part.substring(4).trim();
    } else if (part.toLowerCase().startsWith('cat:') || part.toLowerCase().startsWith('category:')) {
      task.category = part.split(':')[1].trim();
    } else if (part.toLowerCase().startsWith('diff:') || part.toLowerCase().startsWith('difficulty:')) {
      const diff = part.split(':')[1].trim().toLowerCase();
      if (['easy', 'medium', 'hard'].includes(diff)) {
        task.difficulty = diff;
      }
    }
  }
  
  return task;
}

/**
 * Format task for display
 */
function formatTask(task) {
  const difficultyEmojis = {
    easy: '🟢',
    medium: '🟡',
    hard: '🔴'
  };
  
  let message = `📝 **Task:** ${task.text}`;
  
  if (task.why) {
    message += `\n💡 **Why:** ${task.why}`;
  }
  
  if (task.category) {
    message += `\n📁 **Category:** ${task.category}`;
  }
  
  message += `\n${difficultyEmojis[task.difficulty]} **Difficulty:** ${task.difficulty}`;
  
  if (task.completed_at) {
    message += `\n✅ **Completed:** ${new Date(task.completed_at).toLocaleString()}`;
  }
  
  return message;
}

/**
 * Setup task-related command handlers
 */
export function setupTaskHandlers(bot) {
  // Set task command
  bot.command('settask', async (ctx) => {
    const input = ctx.message.text.replace(/^\/settask\s*/i, '').trim();
    
    if (!input) {
      return ctx.reply(`
📝 **Set Today's Task**

Usage: \`/settask <task> | why: <reason> | cat: <category> | diff: <difficulty>\`

Examples:
• \`/settask Write project proposal\`
• \`/settask Exercise for 30 min | why: Stay healthy\`
• \`/settask Code review | why: Team deadline | cat: work | diff: hard\`

Tips:
• Keep tasks specific and achievable
• Adding "why" helps with motivation
• Categories help track patterns
• Difficulty: easy, medium, hard`, 
        { parse_mode: 'Markdown' }
      );
    }
    
    const task = parseTaskInput(input);
    
    if (!task.text) {
      return ctx.reply('❌ Task description cannot be empty');
    }
    
    // Add task to database
    const result = addTask.run(
      ctx.from.id,
      task.text,
      task.why,
      task.category,
      task.difficulty
    );
    
    info(`User ${ctx.from.id} created task: ${task.text}`);
    
    const response = `
✅ **Task Set Successfully!**

${formatTask({ ...task, id: result.lastInsertRowid })}

🎯 Use /done when you complete it
⏭️ Use /skip if you need to skip today`;
    
    return ctx.reply(response, { parse_mode: 'Markdown' });
  });
  
  // View current task
  bot.command('task', async (ctx) => {
    const task = getLastTask.get(ctx.from.id);
    
    if (!task) {
      return ctx.reply(`
❌ No task set yet

Use \`/settask <task>\` to set your focus for today`, 
        { parse_mode: 'Markdown' }
      );
    }
    
    const response = `
📋 **Current Task**

${formatTask(task)}

${!task.completed_at ? '\n🎯 Use /done when complete' : ''}`;
    
    return ctx.reply(response, { parse_mode: 'Markdown' });
  });
  
  // List today's tasks
  bot.command('today', async (ctx) => {
    const tasks = getTodaysTasks.all(ctx.from.id);
    
    if (tasks.length === 0) {
      return ctx.reply(`
📅 **No tasks for today yet**

Use \`/settask <task>\` to add one!`, 
        { parse_mode: 'Markdown' }
      );
    }
    
    let response = `📅 **Today's Tasks** (${tasks.length})\n\n`;
    
    tasks.forEach((task, index) => {
      const status = task.completed_at ? '✅' : '⏳';
      response += `${status} ${index + 1}. ${task.text}`;
      if (task.why) response += ` _(${task.why})_`;
      response += '\n';
    });
    
    return ctx.reply(response, { parse_mode: 'Markdown' });
  });
  
  // Quick task templates
  bot.command('templates', async (ctx) => {
    const templates = `
📋 **Quick Task Templates**

**Work:**
• \`/settask Review emails and respond | why: Stay on top of communication\`
• \`/settask Complete project milestone | why: Meet deadline\`
• \`/settask Prepare for meeting | why: Be organized\`

**Health:**
• \`/settask Exercise for 30 minutes | why: Maintain energy\`
• \`/settask Take medication | why: Health management\`
• \`/settask Meal prep | why: Eat healthy\`

**Personal:**
• \`/settask Read one chapter | why: Personal growth\`
• \`/settask Call friend/family | why: Stay connected\`
• \`/settask Clean workspace | why: Reduce clutter\`

**ADHD Management:**
• \`/settask Morning routine | why: Start day right\`
• \`/settask Time block calendar | why: Stay organized\`
• \`/settask Brain dump journal | why: Clear mind\`

💡 Tip: Customize these to fit your needs!`;
    
    return ctx.reply(templates, { parse_mode: 'Markdown' });
  });
}