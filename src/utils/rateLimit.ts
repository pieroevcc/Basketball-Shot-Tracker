const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_REQUESTS = 100;
const STORAGE_KEY_PREFIX = 'rl_timestamps_';

// Daily write cap per browser. High enough to never block honest testing
// (~20+ full playthroughs/day), low enough to stop a runaway loop well under
// Firestore's 20k/day free-tier write quota.
// ponytail: client-side per-browser cap, not a true server-side global —
// enforce in Firestore rules / a backend counter if abuse matters.
export const DAILY_MAX = 2000;
const GLOBAL_DAILY_KEY = 'rl_global_daily';

function todayKey(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

function getGlobalDailyCount(): number {
  try {
    const raw = localStorage.getItem(GLOBAL_DAILY_KEY);
    if (!raw) return 0;
    const { date, count } = JSON.parse(raw);
    return date === todayKey() ? count : 0; // stale day resets to 0
  } catch {
    return 0;
  }
}

function msUntilTomorrow(): number {
  const now = new Date();
  const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return midnight - now.getTime();
}

export class RateLimitError extends Error {
  constructor(public readonly retryAfterMs: number) {
    super(
      `Rate limit exceeded. Try again in ${Math.ceil(retryAfterMs / 60_000)} minute(s).`
    );
    this.name = 'RateLimitError';
  }
}

function getPrunedTimestamps(deviceId: string): number[] {
  const now = Date.now();
  const cutoff = now - WINDOW_MS;
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${deviceId}`);
    const timestamps: number[] = raw ? JSON.parse(raw) : [];
    return timestamps.filter((t) => t > cutoff);
  } catch {
    return [];
  }
}

/**
 * Throws RateLimitError if the device has exceeded 100 writes in the last 15 minutes.
 * Call this BEFORE a Firestore write operation.
 */
export function checkRateLimit(deviceId: string): void {
  if (getGlobalDailyCount() >= DAILY_MAX) {
    throw new RateLimitError(msUntilTomorrow());
  }
  const pruned = getPrunedTimestamps(deviceId);
  if (pruned.length >= MAX_REQUESTS) {
    const oldest = Math.min(...pruned);
    const retryAfterMs = oldest + WINDOW_MS - Date.now();
    throw new RateLimitError(Math.max(0, retryAfterMs));
  }
}

/**
 * Records one write request for the given device.
 * Call this AFTER a Firestore write succeeds so failed writes don't count.
 */
export function trackRequest(deviceId: string): void {
  const pruned = getPrunedTimestamps(deviceId);
  pruned.push(Date.now());
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${deviceId}`, JSON.stringify(pruned));
  } catch {
    // localStorage full — non-fatal, skip recording
  }
  try {
    localStorage.setItem(
      GLOBAL_DAILY_KEY,
      JSON.stringify({ date: todayKey(), count: getGlobalDailyCount() + 1 })
    );
  } catch {
    // localStorage full — non-fatal, skip recording
  }
}
