import { afterEach, expect, it, vi } from 'vitest';

// Only the remote limiter boundary is replaced; exercise the real budget policy.
const decisions = vi.hoisted(() => new Map<string, { success: boolean; reason?: string }>());
vi.mock('#lib/redis.js', () => ({ redis: {} }));
vi.mock('@upstash/ratelimit', () => ({ Ratelimit: class {
 static slidingWindow() {} static fixedWindow() {}
 constructor(private options: { prefix: string }) {}
 async limit() { return decisions.get(this.options.prefix) ?? { success: true }; }
} }));
import { allowAi } from './limits';
afterEach(() => decisions.clear());

it('denies inference when the shared burst budget is exhausted despite available daily budget', async () => {
 decisions.set('bible:study:ai-burst', { success: false });
 expect(await allowAi()).toBe(false);
});

it.each(['bible:study:ai-total', 'bible:study:ai-burst'])('fails closed on a timeout from %s', async prefix => {
 decisions.set(prefix, { success: true, reason: 'timeout' });
 expect(await allowAi()).toBe(false);
});
it('denies inference after the daily budget is exhausted', async () => {
 decisions.set('bible:study:ai-total', { success: false });
 expect(await allowAi()).toBe(false);
});
it('permits inference when both durable budgets allow it', async () => {
 expect(await allowAi()).toBe(true);
});
