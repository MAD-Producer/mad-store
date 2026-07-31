interface RateLimitEntry {
  id: symbol;
  timestamp: number;
}

export type RateLimitReservation =
  | { allowed: true; release: () => void }
  | { allowed: false; retryAfterSeconds: number };

const buckets = new Map<string, RateLimitEntry[]>();

export function reserveRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitReservation {
  const now = Date.now();
  const recent = (buckets.get(key) || []).filter(
    (entry) => entry.timestamp > now - windowMs,
  );

  if (recent.length >= limit) {
    buckets.set(key, recent);
    return {
      allowed: false,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((recent[0].timestamp + windowMs - now) / 1000),
      ),
    };
  }

  const entry = { id: Symbol(key), timestamp: now };
  recent.push(entry);
  buckets.set(key, recent);
  let released = false;

  return {
    allowed: true,
    release() {
      if (released) return;
      released = true;
      const remaining = (buckets.get(key) || []).filter((item) => item.id !== entry.id);
      if (remaining.length) buckets.set(key, remaining);
      else buckets.delete(key);
    },
  };
}

export function rateLimit(key: string, limit: number, windowMs: number) {
  return reserveRateLimit(key, limit, windowMs).allowed;
}
