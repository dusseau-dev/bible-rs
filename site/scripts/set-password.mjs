import { readFile, writeFile, chmod } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { hashPassword } from '../src/lib/server/password.js';

async function setPassword() {
	if (!process.stdin.isTTY) throw new Error('Run this command in an interactive terminal. Never pass a password as an argument.');
	const hidden = new Writable({ write(_chunk, _encoding, done) { done(); } });
	const terminal = createInterface({ input: process.stdin, output: hidden, terminal: true });
	const cancellation = new AbortController();
	terminal.once('close', () => cancellation.abort());
	terminal.once('SIGINT', () => terminal.close());
	try {
		let password;
		for (;;) {
			process.stdout.write('New owner password (15–256 characters, hidden): ');
			password = await terminal.question('', { signal: cancellation.signal });
			process.stdout.write('\n');
			if (password.length < 15) {
				console.log('Use at least 15 characters. A passphrase of several words works well. Please try again.');
				continue;
			}
			if (password.length > 256) {
				console.log('Use at most 256 characters. Please try again.');
				continue;
			}
			process.stdout.write('Confirm password (hidden): ');
			const confirmation = await terminal.question('', { signal: cancellation.signal });
			process.stdout.write('\n');
			if (password === confirmation) break;
			console.log('Passwords did not match. Nothing changed. Please try again.');
		}
		const hash = await hashPassword(password);
		const path = new URL('../.env.development.local', import.meta.url);
		let previous = '';
		try { previous = await readFile(path, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
		const lines = previous.split('\n').filter(line => !/^\s*AUTH_PASSWORD_HASH\s*=/.test(line));
		await writeFile(path, `${lines.join('\n').trimEnd()}\nAUTH_PASSWORD_HASH=${hash}\n`, { mode: 0o600 });
		await chmod(path, 0o600);
		console.log('Owner password hash saved to site/.env.development.local. Restart the dev server. Existing sessions expire when the new configuration loads.');
	} finally { terminal.close(); }
}

try { await setPassword(); }
catch (error) {
	const cancelled = error.code === 'ABORT_ERR';
	console.error(cancelled ? '\nPassword setup cancelled. Nothing changed.' : error.message);
	process.exitCode = cancelled ? 130 : 1;
}
