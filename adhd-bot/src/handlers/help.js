/**
 * Setup help command handlers
 */
export function setupHelpHandlers(bot) {
  // Main help command
  bot.help(async (ctx) => {
    const helpText = `
🧠 **ADHD Accountability Bot Help**

**📝 Task Commands:**
• \`/settask <task>\` - Set today's focus task
• \`/task\` - View current task
• \`/today\` - List today's tasks
• \`/templates\` - View task templates

**✅ Check-in Commands:**
• \`/done\` - Mark task as complete
• \`/skip\` - Skip today (breaks streak)
• \`/checkin <mood> <energy>\` - Add mood/energy (1-5)
• \`/note <text>\` - Add notes to today's check-in

**📊 Analytics Commands:**
• \`/status\` - View streak and today's status
• \`/week\` - Last 7 days summary
• \`/month\` - Last 30 days summary
• \`/stats\` - Detailed statistics

**⚙️ Settings Commands:**
• \`/tz <timezone>\` - Set your timezone
• \`/reminder on|off\` - Toggle daily reminders
• \`/profile\` - View your profile

**ℹ️ Info Commands:**
• \`/help\` - Show this help message
• \`/tips\` - ADHD management tips
• \`/about\` - About this bot

💡 **Quick Start:**
1. Set a task: \`/settask Write report\`
2. Complete it: \`/done\`
3. Check progress: \`/status\``;
    
    return ctx.reply(helpText, { parse_mode: 'Markdown' });
  });
  
  // Tips command
  bot.command('tips', async (ctx) => {
    const tips = `
💡 **ADHD Management Tips**

**🎯 Task Setting:**
• Keep tasks specific and measurable
• Break large tasks into smaller ones
• Focus on ONE main task per day
• Add "why" to increase motivation
• Set tasks the night before

**⏰ Time Management:**
• Use time blocking
• Set realistic expectations
• Account for transition time
• Use visual timers
• Take regular breaks

**🧠 Focus Strategies:**
• Remove distractions before starting
• Use body doubling (work alongside others)
• Try the Pomodoro Technique
• Change environments if stuck
• Use fidget tools if helpful

**📝 Accountability:**
• Check in daily, even if you skip
• Track mood and energy patterns
• Celebrate small wins
• Be kind to yourself on bad days
• Focus on progress, not perfection

**🔄 Building Habits:**
• Start extremely small
• Link new habits to existing ones
• Use visual reminders
• Reward yourself for consistency
• Track streaks for motivation

Remember: **Consistency > Perfection** 💪`;
    
    return ctx.reply(tips, { parse_mode: 'Markdown' });
  });
  
  // About command
  bot.command('about', async (ctx) => {
    const about = `
🧠 **About ADHD Accountability Bot**

This bot is designed to help people with ADHD build consistent habits through:

• **Simple daily check-ins** - No overwhelm
• **Streak tracking** - Visual progress
• **Flexible system** - Skip days without guilt
• **Pattern recognition** - Track what works
• **Gentle reminders** - Stay on track

**Why it works for ADHD:**
• External accountability
• Immediate feedback
• Visual progress tracking
• Low cognitive load
• Flexibility for bad days

**Privacy:**
• Your data stays private
• No sharing with third parties
• You control your information

**Support:**
• Created with ❤️ for the ADHD community
• Open source and free to use
• Feedback welcome!

Version: 1.0.0`;
    
    return ctx.reply(about, { parse_mode: 'Markdown' });
  });
  
  // Quick command reference
  bot.command('commands', async (ctx) => {
    const commands = `
📋 **Quick Command Reference**

**Daily Flow:**
\`/settask\` → \`/done\` → \`/status\`

**Most Used:**
• \`/settask\` - Set task
• \`/done\` - Mark complete
• \`/skip\` - Skip day
• \`/status\` - Check streak
• \`/week\` - Weekly view

**Settings:**
• \`/tz\` - Timezone
• \`/reminder\` - Notifications

Type any command without parameters to see usage help!`;
    
    return ctx.reply(commands, { parse_mode: 'Markdown' });
  });
}