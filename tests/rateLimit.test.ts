import { describe, it, expect, beforeEach } from 'vitest';
import { checkRateLimit, trackRequest, RateLimitError, DAILY_MAX } from '../src/utils/rateLimit';

// Covers the global daily cap added on top of the per-device limiter.
describe('global daily rate limit', () => {
  beforeEach(() => localStorage.clear());

  it('throws after DAILY_MAX global requests in a day', () => {
    for (let i = 0; i < DAILY_MAX; i++) trackRequest(`dev-${i}`); // unique devices → only global counter accumulates
    expect(() => checkRateLimit('fresh-device')).toThrow(RateLimitError);
  });

  it('resets when the stored day is stale', () => {
    localStorage.setItem('rl_global_daily', JSON.stringify({ date: '2000-01-01', count: 999 }));
    expect(() => checkRateLimit('dev')).not.toThrow(); // old day → treated as 0
  });
});
