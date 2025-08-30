-- Initial database schema for ADHD Accountability Bot

-- Users table
CREATE TABLE IF NOT EXISTS users (
    telegram_id INTEGER PRIMARY KEY,
    username TEXT,
    first_name TEXT,
    last_name TEXT,
    tz TEXT NOT NULL DEFAULT 'America/New_York',
    reminder_enabled BOOLEAN DEFAULT 1,
    reminder_time TEXT DEFAULT '09:00',
    language TEXT DEFAULT 'en',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id INTEGER NOT NULL,
    text TEXT NOT NULL,
    why TEXT,
    category TEXT,
    difficulty TEXT CHECK(difficulty IN ('easy', 'medium', 'hard')),
    completed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (telegram_id) REFERENCES users(telegram_id) ON DELETE CASCADE
);

-- Check-ins table
CREATE TABLE IF NOT EXISTS checkins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('done', 'skip', 'miss')),
    task_id INTEGER,
    task_text TEXT,
    notes TEXT,
    mood INTEGER CHECK(mood BETWEEN 1 AND 5),
    energy INTEGER CHECK(energy BETWEEN 1 AND 5),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(telegram_id, date),
    FOREIGN KEY (telegram_id) REFERENCES users(telegram_id) ON DELETE CASCADE,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL
);

-- Streaks table
CREATE TABLE IF NOT EXISTS streaks (
    telegram_id INTEGER PRIMARY KEY,
    current INTEGER NOT NULL DEFAULT 0,
    best INTEGER NOT NULL DEFAULT 0,
    failures INTEGER NOT NULL DEFAULT 0,
    total_checkins INTEGER NOT NULL DEFAULT 0,
    last_checkin_date TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (telegram_id) REFERENCES users(telegram_id) ON DELETE CASCADE
);

-- Reminders table
CREATE TABLE IF NOT EXISTS reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id INTEGER NOT NULL,
    type TEXT NOT NULL DEFAULT 'daily',
    time TEXT NOT NULL,
    message TEXT,
    enabled BOOLEAN DEFAULT 1,
    last_sent TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (telegram_id) REFERENCES users(telegram_id) ON DELETE CASCADE
);

-- Analytics table
CREATE TABLE IF NOT EXISTS analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id INTEGER NOT NULL,
    event_type TEXT NOT NULL,
    event_data TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (telegram_id) REFERENCES users(telegram_id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tasks_telegram_id ON tasks(telegram_id);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);
CREATE INDEX IF NOT EXISTS idx_checkins_telegram_id ON checkins(telegram_id);
CREATE INDEX IF NOT EXISTS idx_checkins_date ON checkins(date);
CREATE INDEX IF NOT EXISTS idx_checkins_status ON checkins(status);
CREATE INDEX IF NOT EXISTS idx_analytics_telegram_id ON analytics(telegram_id);
CREATE INDEX IF NOT EXISTS idx_analytics_event_type ON analytics(event_type);

-- Triggers for updated_at
CREATE TRIGGER IF NOT EXISTS update_users_timestamp 
AFTER UPDATE ON users
BEGIN
    UPDATE users SET updated_at = datetime('now')
    WHERE telegram_id = NEW.telegram_id;
END;

CREATE TRIGGER IF NOT EXISTS update_streaks_timestamp
AFTER UPDATE ON streaks
BEGIN
    UPDATE streaks SET updated_at = datetime('now')
    WHERE telegram_id = NEW.telegram_id;
END;