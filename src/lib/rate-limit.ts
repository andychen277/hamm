// Simple in-memory rate limiter for PIN login
const attempts = new Map<string, { count: number; lockedUntil: number }>();

const MAX_ATTEMPTS = 5;
const LOCK_DURATION = 30 * 60 * 1000; // 30 minutes

export function checkPinRateLimit(ip: string): { allowed: boolean; remainingAttempts: number; lockedUntilMs?: number } {
  const now = Date.now();
  const record = attempts.get(ip);

  if (record) {
    if (record.lockedUntil > now) {
      return { allowed: false, remainingAttempts: 0, lockedUntilMs: record.lockedUntil };
    }
    if (record.lockedUntil <= now && record.count >= MAX_ATTEMPTS) {
      // Lock expired, reset
      attempts.delete(ip);
    }
  }

  return { allowed: true, remainingAttempts: MAX_ATTEMPTS - (record?.count || 0) };
}

export function recordPinFailure(ip: string): void {
  const record = attempts.get(ip) || { count: 0, lockedUntil: 0 };
  record.count += 1;
  if (record.count >= MAX_ATTEMPTS) {
    record.lockedUntil = Date.now() + LOCK_DURATION;
  }
  attempts.set(ip, record);
}

export function resetPinAttempts(ip: string): void {
  attempts.delete(ip);
}
