import { beforeEach, expect, it, vi } from 'vitest';
const { data, client } = vi.hoisted(() => {
 const data = new Map<string, unknown>();
 return { data, client: { get: vi.fn(async (k: string) => data.get(k) ?? null), set: vi.fn(async (k: string, value: unknown, opts?: { nx?: boolean }) => { if (opts?.nx && data.has(k)) return null; data.set(k, value); return 'OK'; }), eval: vi.fn(async (script: string, keys: string[], args: string[]) => { if (data.get(keys[0]) !== args[0]) return 0; if (script.includes("KEYS[2]")) data.set(keys[1], JSON.parse(args[1])); data.delete(keys[0]); return 1; }) } };
});
vi.mock('#lib/redis.js', () => ({ redis: client }));
import { savePacket, loadPacket, ownerDigest, claimLesson, publishLesson, releaseLesson, getLesson } from './lesson-store';
import { fixturePacket, fixtureDiscovery, fixtureLesson } from './discovery-fixtures';
beforeEach(() => { data.clear(); vi.clearAllMocks(); });
it('isolates owners and rejects expired or tampered packet versions', async () => {
 expect(ownerDigest('a@example.test')).toMatch(/^[a-f0-9]{64}$/);
 expect(ownerDigest('a@example.test')).not.toBe(ownerDigest('b@example.test'));
 const bundle = await savePacket('a', fixturePacket(), [fixtureDiscovery()]);
 expect(await loadPacket('b', bundle.packetId!)).toBeNull();
 expect((await loadPacket('a', bundle.packetId!))?.discoveries).toHaveLength(1);
 const stored = [...data.values()][0] as { schemaVersion: string }; stored.schemaVersion = 'old';
 await expect(loadPacket('a', bundle.packetId!)).rejects.toThrow('expired');
});
it('permits one claimant and rejects stale publish/release, reusing checked results', async () => {
 const bundle = await savePacket('a', fixturePacket(), [fixtureDiscovery()]);
 const id = bundle.packetId!, d = fixtureDiscovery().id;
 const claims = await Promise.all([claimLesson('a', id, d), claimLesson('a', id, d)]);
 expect(claims.filter(Boolean)).toHaveLength(1);
 const token = claims.find(Boolean)!;
 await releaseLesson('a', id, d, 'wrong');
 expect(await claimLesson('a', id, d)).toBeNull();
 expect(await publishLesson('a', id, d, 'wrong', { status: 'complete', lesson: fixtureLesson(), sources: fixturePacket().documents.map(x => x.source) })).toBe(false);
 expect(await publishLesson('a', id, d, token, { status: 'complete', lesson: fixtureLesson(), sources: fixturePacket().documents.map(x => x.source) })).toBe(true);
 expect((await getLesson('a', id, d))?.status).toBe('complete');
 expect(await getLesson('b', id, d)).toBeNull();
});
it('never stores a structurally invalid lesson', async () => {
 const b = await savePacket('a', fixturePacket(), [fixtureDiscovery()]);
 const token = await claimLesson('a', b.packetId!, fixtureDiscovery().id);
 const lesson = fixtureLesson(); lesson.sections = [];
 expect(await publishLesson('a', b.packetId!, lesson.discoveryId, token!, { status: 'complete', lesson, sources: fixturePacket().documents.map(d => d.source) })).toBe(false);
});
