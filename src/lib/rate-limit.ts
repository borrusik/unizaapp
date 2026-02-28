/**
 * Simple in-memory rate limiter.
 * Tracks request counts per key (usually IP) within a sliding time window.
 * Automatically cleans up expired entries to prevent memory leaks.
 */

type RateLimitEntry = {
  count: number;
  resetTime: number;
};

const rateLimitMap = new Map<string, RateLimitEntry>();

// Cleanup old entries every 5 minutes to avoid memory leaks
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;

  for (const [key, entry] of rateLimitMap.entries()) {
    if (now > entry.resetTime) {
      rateLimitMap.delete(key);
    }
  }

  // Hard cap: if map grows too large, clear everything
  if (rateLimitMap.size > 10000) {
    rateLimitMap.clear();
  }
}

/**
 * Check if a request should be rate limited.
 * @param key - Unique identifier (e.g., IP address)
 * @param maxRequests - Maximum number of requests allowed in the window
 * @param windowMs - Time window in milliseconds
 * @returns { limited: boolean, remaining: number, resetIn: number }
 */
export function rateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { limited: boolean; remaining: number; resetIn: number } {
  cleanup();

  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetTime) {
    // First request or expired window — start fresh
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
    return { limited: false, remaining: maxRequests - 1, resetIn: windowMs };
  }

  entry.count++;

  if (entry.count > maxRequests) {
    return {
      limited: true,
      remaining: 0,
      resetIn: entry.resetTime - now,
    };
  }

  return {
    limited: false,
    remaining: maxRequests - entry.count,
    resetIn: entry.resetTime - now,
  };
}
