import test from 'node:test';
import assert from 'node:assert';
import { openDb, closeDb } from '../src/db/sqlite.js';
import { getOrCreateStreak, applyDone, applyMiss, calculateSuccessRate } from '../src/lib/streaks.js';

test('Streak calculations', async (t) => {
  // Setup
  openDb();
  const testUserId = 999999999;
  
  await t.test('should create new streak for user', () => {
    const streak = getOrCreateStreak(testUserId);
    assert.strictEqual(streak.current, 0);
    assert.strictEqual(streak.best, 0);
    assert.strictEqual(streak.failures, 0);
  });
  
  await t.test('should increment streak on done', () => {
    const streak = applyDone(testUserId, '2024-01-01');
    assert.strictEqual(streak.current, 1);
    assert.strictEqual(streak.best, 1);
    assert.strictEqual(streak.total_checkins, 1);
  });
  
  await t.test('should continue streak on consecutive days', () => {
    const streak = applyDone(testUserId, '2024-01-02');
    assert.strictEqual(streak.current, 2);
    assert.strictEqual(streak.best, 2);
  });
  
  await t.test('should reset streak on miss', () => {
    const streak = applyMiss(testUserId, '2024-01-03');
    assert.strictEqual(streak.current, 0);
    assert.strictEqual(streak.best, 2); // Best preserved
    assert.strictEqual(streak.failures, 1);
  });
  
  await t.test('should calculate success rate correctly', () => {
    const rate = calculateSuccessRate(testUserId);
    // 2 successes, 1 failure = 66.67%
    assert.strictEqual(rate, 67);
  });
  
  // Cleanup
  closeDb();
});

test('Date handling', async (t) => {
  await t.test('should not double-count same day', () => {
    openDb();
    const testUserId = 888888888;
    
    applyDone(testUserId, '2024-01-01');
    const streak1 = applyDone(testUserId, '2024-01-01');
    const streak2 = applyDone(testUserId, '2024-01-01');
    
    assert.strictEqual(streak1.current, streak2.current);
    assert.strictEqual(streak1.total_checkins, 1);
    
    closeDb();
  });
});