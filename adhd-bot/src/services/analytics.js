import { prepare } from '../db/sqlite.js';
import { debug } from '../logger.js';

// Insert analytics event
const insertEvent = prepare(`
  INSERT INTO analytics (telegram_id, event_type, event_data)
  VALUES (?, ?, ?)
`);

/**
 * Track an analytics event
 */
export function trackEvent(telegramId, eventType, eventData = {}) {
  try {
    if (process.env.ENABLE_ANALYTICS !== 'true') {
      return;
    }
    
    insertEvent.run(
      telegramId,
      eventType,
      JSON.stringify(eventData)
    );
    
    debug(`Analytics: ${eventType} for user ${telegramId}`);
  } catch (err) {
    // Fail silently for analytics
    debug(`Analytics error: ${err.message}`);
  }
}

/**
 * Get user analytics summary
 */
export function getUserAnalytics(telegramId, days = 30) {
  const events = prepare(`
    SELECT event_type, COUNT(*) as count
    FROM analytics
    WHERE telegram_id = ?
      AND created_at >= datetime('now', '-${days} days')
    GROUP BY event_type
  `).all(telegramId);
  
  return events;
}

/**
 * Get most active users
 */
export function getMostActiveUsers(limit = 10) {
  return prepare(`
    SELECT 
      telegram_id,
      COUNT(*) as event_count,
      COUNT(DISTINCT date(created_at)) as active_days
    FROM analytics
    WHERE created_at >= datetime('now', '-30 days')
    GROUP BY telegram_id
    ORDER BY event_count DESC
    LIMIT ?
  `).all(limit);
}

/**
 * Get command usage stats
 */
export function getCommandUsage() {
  return prepare(`
    SELECT 
      json_extract(event_data, '$.command') as command,
      COUNT(*) as usage_count
    FROM analytics
    WHERE event_type = 'command'
      AND created_at >= datetime('now', '-7 days')
    GROUP BY command
    ORDER BY usage_count DESC
  `).all();
}