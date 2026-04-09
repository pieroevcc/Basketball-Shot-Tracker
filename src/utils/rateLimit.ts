const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_REQUESTS = 100;
const STORAGE_KEY_PREFIX = 'rl_timestamps_';

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
}
