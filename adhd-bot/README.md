# 🧠 ADHD Accountability Bot

A Telegram bot designed to help people with ADHD maintain daily accountability through simple task tracking and streak management.

## 🎯 Features

- **Daily Task Setting**: Set one focused task per day with a "why" motivation
- **Check-in System**: Mark tasks as done or skip with accountability
- **Streak Tracking**: Maintain motivation with current/best streak metrics
- **Timezone Support**: Personalized check-ins based on user timezone
- **Reminders**: Optional daily reminders (configurable)
- **Analytics**: Track patterns and progress over time

## 🚀 Quick Start

### 1. Prerequisites
- Node.js 18+ installed
- Telegram Bot Token from [@BotFather](https://t.me/botfather)

### 2. Installation
```bash
# Clone and setup
git clone <repo>
cd adhd-bot
npm install

# Configure environment
cp .env.example .env
# Edit .env and add your TELEGRAM_BOT_TOKEN

# Initialize database
npm run db:reset

# Start the bot
npm run dev
```

## 💬 Bot Commands

### Core Commands
- `/start` - Initialize bot and create user profile
- `/settask <task> | why: <reason>` - Set today's focus task
- `/task` - View current task
- `/done` - Mark today's task as complete
- `/skip` - Skip today (breaks streak)
- `/status` - View streak and today's status

### Configuration
- `/tz <timezone>` - Set your timezone (e.g., `/tz America/New_York`)
- `/reminder on|off` - Toggle daily reminders
- `/help` - Show all commands

### Analytics
- `/week` - View last 7 days
- `/month` - View last 30 days  
- `/stats` - Overall statistics

## 📊 Database Schema

### Users Table
```sql
CREATE TABLE users (
    telegram_id INTEGER PRIMARY KEY,
    username TEXT,
    first_name TEXT,
    tz TEXT NOT NULL DEFAULT 'America/New_York',
    reminder_enabled BOOLEAN DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### Tasks Table
```sql
CREATE TABLE tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id INTEGER NOT NULL,
    text TEXT NOT NULL,
    why TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (telegram_id) REFERENCES users(telegram_id)
);
```

### Check-ins Table
```sql
CREATE TABLE checkins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    status TEXT NOT NULL, -- 'done', 'skip', 'miss'
    task_text TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(telegram_id, date)
);
```

### Streaks Table
```sql
CREATE TABLE streaks (
    telegram_id INTEGER PRIMARY KEY,
    current INTEGER NOT NULL DEFAULT 0,
    best INTEGER NOT NULL DEFAULT 0,
    failures INTEGER NOT NULL DEFAULT 0,
    last_checkin_date TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

## 🔧 Development

### Project Structure
```
adhd-bot/
├── src/
│   ├── bot.js           # Main bot entry point
│   ├── db/
│   │   └── sqlite.js     # Database connection
│   ├── handlers/         # Command handlers
│   │   ├── tasks.js      # Task-related commands
│   │   ├── checkins.js   # Check-in commands
│   │   └── analytics.js  # Stats and reports
│   ├── lib/
│   │   ├── time.js       # Timezone utilities
│   │   └── streaks.js    # Streak calculations
│   ├── middleware/
│   │   └── auth.js       # User authentication
│   └── services/
│       ├── reminder.js   # Reminder cron jobs
│       └── firebase.js   # Optional Firebase sync
├── migrations/           # Database migrations
├── seeds/               # Sample data
├── tools/               # Utility scripts
└── tests/               # Test files
```

### Testing
```bash
# Run tests
npm test

# Test specific command
node tests/streaks.test.js
```

### Database Management
```bash
# Reset database (migrate + seed)
npm run db:reset

# Run migrations only
npm run migrate

# Backup database
npm run backup
```

## 🧩 Advanced Features

### Daily Reminders
The bot can send daily reminders at a configured time:
- Set globally via `REMINDER_HOUR` and `REMINDER_MINUTE` in `.env`
- Users can toggle with `/reminder on|off`
- Respects user timezone settings

### Firebase Integration (Optional)
For data backup and cross-platform sync:
1. Add Firebase credentials to `.env`
2. Enable with `ENABLE_FIREBASE=true`
3. Data automatically mirrors to Firestore

### Analytics Dashboard
Track patterns and insights:
- Success rate by day of week
- Most productive hours
- Task completion trends
- Failure patterns analysis

## 🛡️ Security Considerations

- Store bot token securely in `.env`
- Never commit `.env` file
- Database stored locally in `data/` directory
- User data isolated by telegram_id
- No personal data shared externally (unless Firebase enabled)

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open Pull Request

## 📝 License

MIT License - feel free to use for personal or commercial projects.

## 🆘 Support

- Create an issue for bugs
- Discussions for feature requests
- Wiki for extended documentation

---

**Built with ❤️ for the ADHD community**