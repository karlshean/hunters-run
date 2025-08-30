import { prepare } from '../db/sqlite.js';
import { todayInTz, daysSince } from './time.js';

// Prepared statements
const getStreak = prepare(`SELECT * FROM streaks WHERE telegram_id = ?`);
const upsertStreak = prepare(`
  INSERT INTO streaks (telegram_id, current, best, failures, total_checkins, last_checkin_date)
  VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT(telegram_id) DO UPDATE SET
    current = excluded.current,
    best = excluded.best,
    failures = excluded.failures,
    total_checkins = excluded.total_checkins,
    last_checkin_date = excluded.last_checkin_date,
    updated_at = datetime('now')
`);

/**
 * Get or create streak for user
 */
export function getOrCreateStreak(telegramId) {
  let streak = getStreak.get(telegramId);
  
  if (!streak) {
    streak = {
      telegram_id: telegramId,
      current: 0,
      best: 0,
      failures: 0,
      total_checkins: 0,
      last_checkin_date: null
    };
    upsertStreak.run(
      telegramId, 
      streak.current, 
      streak.best, 
      streak.failures,
      streak.total_checkins,
      streak.last_checkin_date
    );
  }
  
  return streak;
}

/**
 * Process successful check-in
 */
export function applyDone(telegramId, date) {
  const streak = getOrCreateStreak(telegramId);
  
  // Check if already checked in today
  if (streak.last_checkin_date === date) {
    return streak; // Already counted
  }
  
  // Check if continuing streak or starting new one
  let newCurrent = 1;
  if (streak.last_checkin_date) {
    const daysMissed = daysSince(streak.last_checkin_date) - 1;
    if (daysMissed <= 0) {
      newCurrent = streak.current + 1;
    }
  }
  
  const newBest = Math.max(streak.best, newCurrent);
  const newTotal = streak.total_checkins + 1;
  
  upsertStreak.run(
    telegramId,
    newCurrent,
    newBest,
    streak.failures,
    newTotal,
    date
  );
  
  return {
    current: newCurrent,
    best: newBest,
    failures: streak.failures,
    total_checkins: newTotal,
    last_checkin_date: date
  };
}

/**
 * Process skipped/missed check-in
 */
export function applyMiss(telegramId, date) {
  const streak = getOrCreateStreak(telegramId);
  
  // Check if already processed today
  if (streak.last_checkin_date === date) {
    return streak;
  }
  
  const newFailures = streak.failures + 1;
  const newTotal = streak.total_checkins + 1;
  
  upsertStreak.run(
    telegramId,
    0, // Reset current streak
    streak.best,
    newFailures,
    newTotal,
    date
  );
  
  return {
    current: 0,
    best: streak.best,
    failures: newFailures,
    total_checkins: newTotal,
    last_checkin_date: date
  };
}

/**
 * Calculate success rate
 */
export function calculateSuccessRate(telegramId) {
  const streak = getOrCreateStreak(telegramId);
  
  if (streak.total_checkins === 0) {
    return 0;
  }
  
  const successes = streak.total_checkins - streak.failures;
  return Math.round((successes / streak.total_checkins) * 100);
}

/**
 * Get streak status message
 */
export function getStreakMessage(streak) {
  const rate = streak.total_checkins > 0 
    ? Math.round(((streak.total_checkins - streak.failures) / streak.total_checkins) * 100)
    : 0;
  
  let emoji = '🔥';
  if (streak.current === 0) emoji = '💔';
  else if (streak.current >= 7) emoji = '🎯';
  else if (streak.current >= 30) emoji = '🏆';
  
  return `${emoji} Streak: ${streak.current} days
📊 Best: ${streak.best} days
📈 Success Rate: ${rate}%
📝 Total Check-ins: ${streak.total_checkins}`;
}

/**
 * Check if user needs a reminder based on last check-in
 */
export function needsReminder(telegramId, userTz) {
  const streak = getOrCreateStreak(telegramId);
  const today = todayInTz(userTz);
  
  // No reminder if already checked in today
  if (streak.last_checkin_date === today) {
    return false;
  }
  
  // Remind if no check-in today
  return true;
}

/**
 * Get motivational message based on streak
 */
export function getMotivationalMessage(streak) {
  if (streak.current === 0) {
    return "💪 Every day is a fresh start. You've got this!";
  } else if (streak.current === 1) {
    return "🌱 Great start! One day at a time.";
  } else if (streak.current < 7) {
    return `🔥 ${streak.current} days strong! Keep the momentum going!`;
  } else if (streak.current < 30) {
    return `🎯 Wow, ${streak.current} days! You're building a solid habit!`;
  } else if (streak.current < 100) {
    return `🏆 ${streak.current} days! You're unstoppable!`;
  } else {
    return `👑 ${streak.current} days! You're a legend!`;
  }
}