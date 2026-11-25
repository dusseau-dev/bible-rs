import { beforeAll, expect, it, vi } from 'vitest';
import type { Redis } from '@upstash/redis';
import { createAuth, OWNER_EMAIL } from './auth';
import { hashPassword, verifyPassword } from './password.js';
let hash: string;
const password = 'local-test-password-only';
beforeAll(async () => { hash = await hashPassword(password); });
function fixture() {
	const rows = new Map<string, unknown>();
	const store = { get: vi.fn(async (key: string) => rows.get(key) ?? null), set: vi.fn(async (key: string, value: unknown) => { rows.set(key, value); return 'OK'; }), del: vi.fn(async (key: string) => Number(rows.delete(key))), eval: vi.fn(async () => 1) };
	return { rows, store, auth: createAuth(store as unknown as Redis, hash) };
}
it('hashes with a random salt, verifies correctly, and rejects malformed or huge work parameters', async () => {
	expect(await hashPassword(password)).not.toBe(hash);
	expect(await verifyPassword(password, hash)).toBe(true);
	expect(await verifyPassword('wrong password', hash)).toBe(false);
	expect(await verifyPassword(password, hash.replace('131072', '999999999'))).toBe(false);
	expect(hash).not.toContain(password);
});
it('accepts only the owner and never stores the bearer token in Redis', async () => {
	const { auth, rows } = fixture();
	expect((await auth.login('other@example.com', password, 'ip')).status).toBe('invalid');
	expect((await auth.login(OWNER_EMAIL, 'wrong', 'ip')).status).toBe('invalid');
	const result = await auth.login(OWNER_EMAIL, password, 'ip');
	expect(result.status).toBe('ok'); if (result.status !== 'ok') throw new Error('Login failed');
	expect(await auth.session(result.token)).toBe(OWNER_EMAIL);
	expect(JSON.stringify([...rows])).not.toContain(result.token);
	await auth.logout(result.token); expect(await auth.session(result.token)).toBeNull();
});
it('denies forged, expired, non-owner and pre-password-rotation sessions', async () => {
	const { auth, rows } = fixture();
	expect(await auth.session('forged')).toBeNull();
	const result = await auth.login(OWNER_EMAIL, password, 'ip');
	if (result.status !== 'ok') throw new Error('Login failed');
	const key = [...rows.keys()][0]; const saved = rows.get(key) as Record<string, unknown>;
	for (const change of [{ expiresAt: 0 }, { email: 'other@example.com' }, { credential: 'old hash' }]) {
		rows.set(key, { ...saved, ...change }); expect(await auth.session(result.token)).toBeNull();
	}
});
it('fails closed when configuration or Redis is unavailable and rate-limits before password work', async () => {
	expect(createAuth(null, hash).ready).toBe(false);
	const { auth, store } = fixture();
	store.eval.mockResolvedValue(6);
	expect((await auth.login(OWNER_EMAIL, password, 'ip')).status).toBe('limited');
	store.eval.mockRejectedValue(new Error('secret details'));
	expect(await auth.login(OWNER_EMAIL, password, 'ip')).toEqual({ status: 'unavailable' });
	store.get.mockRejectedValue(new Error('offline'));
	await expect(auth.session('a'.repeat(43))).rejects.toThrow('offline');
});
