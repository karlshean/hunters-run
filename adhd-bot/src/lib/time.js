import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import relativeTime from 'dayjs/plugin/relativeTime.js';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore.js';

// Extend dayjs with plugins
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(relativeTime);
dayjs.extend(isSameOrBefore);

/**
 * Get today's date in user's timezone
 */
export function todayInTz(tz) {
  try {
    return dayjs().tz(tz).format('YYYY-MM-DD');
  } catch {
    // Fallback to UTC if timezone is invalid
    return dayjs().utc().format('YYYY-MM-DD');
  }
}

/**
 * Get current time in user's timezone
 */
export function nowInTz(tz) {
  try {
    return dayjs().tz(tz);
  } catch {
    return dayjs().utc();
  }
}

/**
 * Format date for display
 */
export function formatDate(date, tz, format = 'MMM D, YYYY') {
  try {
    return dayjs(date).tz(tz).format(format);
  } catch {
    return dayjs(date).format(format);
  }
}

/**
 * Check if date is today in given timezone
 */
export function isToday(date, tz) {
  const today = todayInTz(tz);
  return dayjs(date).format('YYYY-MM-DD') === today;
}

/**
 * Check if date is yesterday in given timezone
 */
export function isYesterday(date, tz) {
  const yesterday = dayjs().tz(tz).subtract(1, 'day').format('YYYY-MM-DD');
  return dayjs(date).format('YYYY-MM-DD') === yesterday;
}

/**
 * Get days since date
 */
export function daysSince(date) {
  return dayjs().diff(dayjs(date), 'day');
}

/**
 * Get human-readable time difference
 */
export function timeAgo(date) {
  return dayjs(date).fromNow();
}

/**
 * Parse time string (HH:MM) to hour and minute
 */
export function parseTime(timeStr) {
  const [hour, minute] = timeStr.split(':').map(Number);
  return { hour, minute };
}

/**
 * Check if current time matches target time in timezone
 */
export function isTimeToSend(targetTime, tz) {
  const now = nowInTz(tz);
  const { hour, minute } = parseTime(targetTime);
  
  return now.hour() === hour && now.minute() === minute;
}

/**
 * Get date range for analytics
 */
export function getDateRange(days, tz) {
  const end = todayInTz(tz);
  const start = dayjs().tz(tz).subtract(days - 1, 'day').format('YYYY-MM-DD');
  return { start, end };
}

/**
 * Validate timezone string
 */
export function isValidTimezone(tz) {
  try {
    dayjs().tz(tz);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get week day name
 */
export function getWeekday(date, tz) {
  return dayjs(date).tz(tz).format('dddd');
}