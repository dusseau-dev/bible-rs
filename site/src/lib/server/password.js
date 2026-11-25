import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

// OWASP's scrypt baseline. Fixed parameters prevent configuration-driven work amplification.
const options = { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };
/** @param {string} password @param {Buffer} salt @returns {Promise<Buffer>} */
const derive = (password, salt) => new Promise((resolve, reject) => {
	scrypt(password, salt, 64, options, (error, key) => error ? reject(error) : resolve(key));
});
/** @param {unknown} value */
export function validPasswordHash(value) {
	return typeof value === 'string' && /^scrypt:131072:8:1:[a-f0-9]{32}:[a-f0-9]{128}$/.test(value);
}
/** @param {string} password */
export async function hashPassword(password) {
	if (password.length < 15 || password.length > 256) throw new Error('Use a password between 15 and 256 characters.');
	const salt = randomBytes(16);
	return `scrypt:131072:8:1:${salt.toString('hex')}:${(await derive(password, salt)).toString('hex')}`;
}
/** @param {string} password @param {string} encoded */
export async function verifyPassword(password, encoded) {
	if (!validPasswordHash(encoded) || password.length > 256 || !password) return false;
	const [, , , , salt, key] = encoded.split(':');
	return timingSafeEqual(await derive(password, Buffer.from(salt, 'hex')), Buffer.from(key, 'hex'));
}
