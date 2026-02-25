import { LRUCache } from 'lru-cache';
import { RateLimitTier } from '@/types/enums';

const rateLimitCache = new LRUCache<string, number>({
  max: 500,
  ttl: 60 * 1000, // 1 minute
});

const REQUESTS_PER_MINUTE: Record<RateLimitTier, number> = {
  [RateLimitTier.ANONYMOUS]: 5,
  [RateLimitTier.AUTHENTICATED]: 20,
};

export function checkRateLimit(
  identifier: string,
  isAuthenticated: boolean
): { allowed: boolean; remaining: number; limit: number } {
  const limit = isAuthenticated
    ? REQUESTS_PER_MINUTE[RateLimitTier.AUTHENTICATED]
    : REQUESTS_PER_MINUTE[RateLimitTier.ANONYMOUS];

  const current = rateLimitCache.get(identifier) || 0;

  if (current >= limit) {
    return { allowed: false, remaining: 0, limit };
  }

  rateLimitCache.set(identifier, current + 1, { noUpdateTTL: true });
  return { allowed: true, remaining: limit - current - 1, limit };
}
