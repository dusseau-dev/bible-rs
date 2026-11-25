import { expect, it } from 'vitest';
import { redis } from '#lib/redis.js';
vi.mock('$app/env/private', () => ({ UPSTASH_REDIS_REST_URL: '...', UPSTASH_REDIS_REST_TOKEN: '...' }));
import { vi } from 'vitest';
it('does not crash importing the optional Redis client with placeholders', () => expect(redis).toBeNull());
