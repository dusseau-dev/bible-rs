import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { createServer } from 'node:http';
import { createServer as tcpServer } from 'node:net';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fixturePacket, fixtureDiscovery, fixtureLesson } from './discovery-fixtures';
const state = vi.hoisted(() => ({ url: '' }));
vi.mock('#lib/redis.js', async () => { const { Redis } = await import('@upstash/redis'); return { redis: new Redis({ url: state.url, token: 'disposable', retry: false }) }; });
const exec = promisify(execFile);
let redis: ReturnType<typeof spawn>, port: number;
const bridge = createServer(async (request, response) => {
 try {
  let body = ''; for await (const chunk of request) body += chunk;
  const parsed = JSON.parse(body), pipeline = Array.isArray(parsed[0]);
  const result = [];
  const encode = (v: unknown): unknown => typeof v === 'string' ? Buffer.from(v).toString('base64') : Array.isArray(v) ? v.map(encode) : v;
  for (const command of pipeline ? parsed : [parsed]) {
   const { stdout } = await exec('redis-cli', ['--json', '-p', String(port), ...command.map(String)]);
   const value = JSON.parse(stdout); result.push({ result: request.headers['upstash-encoding'] === 'base64' ? encode(value) : value });
  }
  response.setHeader('content-type', 'application/json'); response.end(JSON.stringify(pipeline ? result : result[0]));
 } catch { response.writeHead(500).end(); }
});
beforeAll(async () => {
 const reservation = tcpServer(); await new Promise<void>(r => reservation.listen(0, '127.0.0.1', r));
 port = (reservation.address() as { port: number }).port; await new Promise<void>(r => reservation.close(() => r()));
 redis = spawn('redis-server', ['--bind', '127.0.0.1', '--port', String(port), '--save', '', '--appendonly', 'no'], { stdio: 'ignore' });
 for (let i = 0; i < 50; i++) { try { await exec('redis-cli', ['-p', String(port), 'PING']); break; } catch { await new Promise(r => setTimeout(r, 20)); } }
 await new Promise<void>(r => bridge.listen(0, '127.0.0.1', r)); state.url = `http://127.0.0.1:${(bridge.address() as { port: number }).port}`;
});
afterAll(async () => { bridge.closeAllConnections(); await new Promise<void>(r => bridge.close(() => r())); redis?.kill('SIGTERM'); });
it('round-trips SDK serialization and atomically rejects a replaced claim against real Redis', async () => {
 const store = await import('./lesson-store');
 const b = await store.savePacket('one', fixturePacket(), [fixtureDiscovery()]), id = b.packetId!, d = fixtureDiscovery().id;
 const token = await store.claimLesson('one', id, d); expect(token).toBeTruthy();
 expect(await store.claimLesson('one', id, d)).toBeNull();
 await store.releaseLesson('one', id, d, token!);
 const replacement = await store.claimLesson('one', id, d);
 await store.releaseLesson('one', id, d, token!);
 const result = { status: 'complete' as const, lesson: fixtureLesson(), sources: fixturePacket().documents.map(d => d.source) };
 expect(await store.publishLesson('one', id, d, token!, result)).toBe(false);
 expect(await store.publishLesson('one', id, d, replacement!, result)).toBe(true);
 expect(await store.getLesson('one', id, d)).toEqual(result);
 expect(await store.getLesson('two', id, d)).toBeNull();
}, 15_000);
