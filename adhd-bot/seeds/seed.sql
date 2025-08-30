-- Sample data for development

-- Demo user
INSERT OR IGNORE INTO users (telegram_id, username, first_name, tz, reminder_enabled) 
VALUES (111111111, 'demo_user', 'Demo', 'America/New_York', 1);

-- Demo tasks
INSERT INTO tasks (telegram_id, text, why, category, difficulty) 
VALUES 
    (111111111, 'Complete project proposal', 'To move forward with the client', 'work', 'hard'),
    (111111111, 'Exercise for 30 minutes', 'To maintain health and energy', 'health', 'medium'),
    (111111111, 'Read one chapter', 'To finish the book this month', 'personal', 'easy');

-- Demo streaks
INSERT OR IGNORE INTO streaks (telegram_id, current, best, failures, total_checkins) 
VALUES (111111111, 3, 7, 2, 10);

-- Demo check-ins for the last week
INSERT OR IGNORE INTO checkins (telegram_id, date, status, task_text, mood, energy)
VALUES 
    (111111111, date('now', '-6 days'), 'done', 'Morning meditation', 4, 3),
    (111111111, date('now', '-5 days'), 'done', 'Write documentation', 3, 4),
    (111111111, date('now', '-4 days'), 'skip', 'Gym workout', 2, 2),
    (111111111, date('now', '-3 days'), 'done', 'Code review', 4, 5),
    (111111111, date('now', '-2 days'), 'done', 'Team meeting prep', 3, 3),
    (111111111, date('now', '-1 days'), 'done', 'Bug fixes', 5, 4);

-- Sample reminders
INSERT INTO reminders (telegram_id, type, time, message, enabled)
VALUES
    (111111111, 'daily', '09:00', '🌅 Good morning! What''s your main focus for today?', 1),
    (111111111, 'daily', '20:00', '🌙 Evening check-in: Did you complete your task?', 1);