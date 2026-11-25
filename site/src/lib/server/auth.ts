import { createHash, randomBytes } from 'node:crypto';
import type { Redis } from '@upstash/redis';
import { validPasswordHash, verifyPassword } from './password.js';

export const OWNER_EMAIL = 'mark@dusseauand.com';
export const SESSION_COOKIE = 'bible_session';
export const SESSION_SECONDS = 12 * 60 * 60;
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const tokenValid = (token: string) => /^[A-Za-z0-9_-]{43}$/.test(token);
const sessionKey = (token: string) => `bible:auth:v1:session:${digest(token)}`;
interface Session { email: string; expiresAt: number; credential: string }
type LoginResult = { status: 'ok'; token: string } | { status: 'invalid' | 'limited' | 'unavailable' };
const ATTEMPT = `local n = redis.call('INCR', KEYS[1]); if n == 1 then redis.call('EXPIRE', KEYS[1], 900) end; return n`;

/** Only session records are stored in Redis; the salted password hash stays in server config. */
export function createAuth(store: Redis | null, passwordHash: string | undefined) {
	const ready = Boolean(store && validPasswordHash(passwordHash));
	let hashing = 0;
	return {
		ready,
		async login(email: string, password: string, address: string): Promise<LoginResult> {
			if (!ready || !store || !passwordHash) return { status: 'unavailable' };
			try {
				const attempts = await store.eval<[], number>(ATTEMPT, [`bible:auth:attempt:${digest(address)}`], []);
				if (attempts > 5) return { status: 'limited' };
				const total = await store.eval<[], number>(ATTEMPT, ['bible:auth:attempt:all'], []);
				if (total > 30 || hashing >= 2) return { status: 'limited' };
				hashing++;
				let valid: boolean;
				try { valid = await verifyPassword(password, passwordHash); } finally { hashing--; }
				if (!valid || email.trim().toLowerCase() !== OWNER_EMAIL) return { status: 'invalid' };
				const token = randomBytes(32).toString('base64url');
				await store.set(sessionKey(token), { email: OWNER_EMAIL, expiresAt: Date.now() + SESSION_SECONDS * 1000, credential: digest(passwordHash) } satisfies Session, { ex: SESSION_SECONDS });
				return { status: 'ok', token };
			} catch { return { status: 'unavailable' }; }
		},
		async session(token: string | undefined): Promise<string | null> {
			if (!ready || !store || !passwordHash) throw new Error('Authentication unavailable');
			if (!token || !tokenValid(token)) return null;
			const session = await store.get<Session>(sessionKey(token));
			if (!session || session.email !== OWNER_EMAIL || session.credential !== digest(passwordHash) || !(session.expiresAt > Date.now())) return null;
			return OWNER_EMAIL;
		},
		async logout(token: string | undefined) {
			if (!ready || !store) throw new Error('Authentication unavailable');
			if (token && tokenValid(token)) await store.del(sessionKey(token));
		}
	};
}
