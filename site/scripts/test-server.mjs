// A real disposable Redis behind a local REST bridge exercises the production SDK without
// using Upstash credentials. This harness is never imported by the application or build.
import { spawn, execFileSync, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer } from 'node:https';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { hashPassword } from '../src/lib/server/password.js';

const artifacts = resolve('../.context/private-e2e');
mkdirSync(artifacts, { recursive: true, mode: 0o700 });
const cert = resolve(artifacts, 'localhost.crt');
const key = resolve(artifacts, 'localhost.key');
execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-keyout', key, '-out', cert, '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1'], { stdio: 'ignore' });
const redisPort = '56379';
const redis = spawn('redis-server', ['--bind', '127.0.0.1', '--port', redisPort, '--save', '', '--appendonly', 'no', '--dir', artifacts], { stdio: 'ignore' });
const exec = promisify(execFile);
let stopped = false;
let app;
const encode = value => typeof value === 'string' ? Buffer.from(value).toString('base64') : Array.isArray(value) ? value.map(encode) : value;
const bridge = createServer({ key: readFileSync(key), cert: readFileSync(cert) }, async (request, response) => {
	response.setHeader('content-type', 'application/json');
	if (request.headers.authorization !== 'Bearer local-test-token') { response.writeHead(401); response.end('{"error":"Unauthorized"}'); return; }
	try {
		let body = ''; for await (const chunk of request) body += chunk;
		const parsed = JSON.parse(body);
		const pipeline = Array.isArray(parsed[0]);
		const results = [];
		for (const command of pipeline ? parsed : [parsed]) {
			// Upstash's lock hint is not understood by stock Redis; Lua semantics are unchanged.
			if (String(command[0]).toLowerCase() === 'eval') command[1] = command[1].replace(/^#!lua[^\n]*\n/, '');
			const { stdout } = await exec('redis-cli', ['--json', '-h', '127.0.0.1', '-p', redisPort, ...command.map(String)]);
			try {
				const value = JSON.parse(stdout);
				results.push({ result: request.headers['upstash-encoding'] === 'base64' ? encode(value) : value });
			} catch { results.push({ error: stdout.trim() }); }
		}
		response.end(JSON.stringify(pipeline ? results : results[0]));
	} catch { response.writeHead(500); response.end('{"error":"Test Redis bridge failed"}'); }
});
function stop() {
	if (stopped) return; stopped = true;
	app?.kill('SIGTERM'); bridge.close(); redis.kill('SIGTERM');
}
process.on('SIGTERM', stop); process.on('SIGINT', stop);
redis.on('error', error => { console.error(error.message); stop(); process.exitCode = 1; });
redis.on('exit', () => { if (!stopped) { console.error('Disposable Redis exited unexpectedly. Check test ports.'); stop(); process.exitCode = 1; } });
for (let i = 0; i < 50; i++) {
	try { await exec('redis-cli', ['-p', redisPort, 'PING']); break; } catch { await new Promise(r => setTimeout(r, 100)); }
}
await new Promise((ready, reject) => { bridge.once('error', reject); bridge.listen(55143, '127.0.0.1', ready); });
const passwordHash = await hashPassword('local-test-password-only');
app = spawn(process.execPath, ['scripts/test-preview.mjs', key, cert], {
	stdio: 'inherit', env: { ...process.env, NODE_EXTRA_CA_CERTS: cert,
		AUTH_PASSWORD_HASH: passwordHash, UPSTASH_REDIS_REST_URL: 'https://127.0.0.1:55143', UPSTASH_REDIS_REST_TOKEN: 'local-test-token',
		CHEAPERINFERENCE_API_KEY: '', OPENAI_API_KEY: '', EXA_API_KEY: '', YOUTUBE_API_KEY: '', OPENALEX_API_KEY: '', NLT_API_KEY: '' }
});
app.on('exit', code => { stop(); process.exitCode = code || 0; });
