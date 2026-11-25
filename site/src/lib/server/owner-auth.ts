import { AUTH_PASSWORD_HASH } from '$app/env/private';
import { redis } from '#lib/redis.js';
import { createAuth } from './auth';
export const ownerAuth = createAuth(redis, AUTH_PASSWORD_HASH);
