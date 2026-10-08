export const API_LIMITS = {
  windowMs: 60_000,
  maxRequests: 60,
  maxBodyBytes: 32_768,
};

export const RATE_OBJECT_NAME = "api-rate";

export function rateKey({ email, ip } = {}) {
  if (email) return `email:${String(email).trim().toLowerCase()}`;
  return `ip:${ip || "unknown"}`;
}

export function nextWindow(record, now, windowMs = API_LIMITS.windowMs) {
  if (!record || now - record.windowStart >= windowMs) return { windowStart: now, count: 1 };
  return { windowStart: record.windowStart, count: record.count + 1 };
}

export function take(store, key, now, limits = API_LIMITS) {
  const next = nextWindow(store.get(key), now, limits.windowMs);
  store.set(key, next);
  if (next.count <= limits.maxRequests) return { allowed: true, retryAfter: 0 };
  const retryAfter = Math.max(1, Math.ceil((next.windowStart + limits.windowMs - now) / 1000));
  return { allowed: false, retryAfter };
}
