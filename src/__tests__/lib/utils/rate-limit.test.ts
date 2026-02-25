import { checkRateLimit } from '@/lib/utils/rate-limit';

describe('Rate Limiter', () => {
  it('should allow requests within the limit', () => {
    const key = `test-allow-${Date.now()}`;
    const result = checkRateLimit(key, false);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBeLessThanOrEqual(result.limit);
  });

  it('should track remaining requests', () => {
    const key = `test-remaining-${Date.now()}`;

    const r1 = checkRateLimit(key, false);
    expect(r1.remaining).toBe(r1.limit - 1);

    const r2 = checkRateLimit(key, false);
    expect(r2.remaining).toBe(r2.limit - 2);
  });

  it('should give higher limits to authenticated users', () => {
    const key1 = `test-auth-${Date.now()}`;
    const key2 = `test-anon-${Date.now()}`;

    const authResult = checkRateLimit(key1, true);
    const anonResult = checkRateLimit(key2, false);

    expect(authResult.limit).toBeGreaterThan(anonResult.limit);
  });

  it('should block requests exceeding the limit', () => {
    const key = `test-block-${Date.now()}`;

    // Exhaust all anonymous requests
    const { limit } = checkRateLimit(key, false);
    for (let i = 1; i < limit; i++) {
      checkRateLimit(key, false);
    }

    const result = checkRateLimit(key, false);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('should use different counters for different keys', () => {
    const key1 = `test-diff1-${Date.now()}`;
    const key2 = `test-diff2-${Date.now()}`;

    checkRateLimit(key1, false);
    const result = checkRateLimit(key2, false);

    expect(result.allowed).toBe(true);
  });
});
