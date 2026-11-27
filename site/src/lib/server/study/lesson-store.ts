import { createHash, randomUUID } from 'node:crypto';
import { redis } from '#lib/redis.js';
import type { Discovery, DiscoveryBundle, LessonResponse } from '#lib/read/discoveries.js';
import type { ResearchPacket, SupportRecord } from './research-packet.js';
import { parseDiscoveries, parseLesson } from './discovery-schema.js';
export const PROMPT_VERSION = 'discovery-lesson-v1', SCHEMA_VERSION = '1';
export const ownerDigest = (owner: string) => createHash('sha256').update(owner.trim().toLowerCase()).digest('hex');
export type StoredPacket = { id: string; ownerDigest: string; packet: ResearchPacket; discoveries: Discovery[]; evidenceVersion: string; promptVersion: string; schemaVersion: string; createdAt: number; expiresAt: number };
const prefix = (owner: string, id: string) => `bible:study:lessons:${SCHEMA_VERSION}:${ownerDigest(owner)}:${id}`;
const claimKey = (owner: string, id: string, discovery: string) => `${prefix(owner, id)}:${discovery}:claim`;
const lessonKey = (owner: string, id: string, discovery: string) => `${prefix(owner, id)}:${discovery}:result`;
const client = () => { if (!redis) throw new Error('Lesson storage unavailable'); return redis; };
export const RELEASE = `if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end; return 0`;
export const PUBLISH = `if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[2], ARGV[2], 'EX', ARGV[3]); redis.call('DEL', KEYS[1]); return 1`;
export async function savePacket(owner: string, packet: ResearchPacket, discoveries: Discovery[]): Promise<DiscoveryBundle> {
 const bundle: DiscoveryBundle = { packetId: null, items: discoveries, evidenceVersion: packet.evidenceVersion, promptVersion: PROMPT_VERSION, research: packet.research };
 if (!owner || !redis) return bundle;
 const known = new Set(packet.documents.filter(d => d.role === 'foundation').map(d => d.source.id));
 if (parseDiscoveries(discoveries, known).length !== discoveries.length) throw new Error('Invalid discoveries');
 const id = randomUUID(), now = Date.now();
 const stored: StoredPacket = { id, ownerDigest: ownerDigest(owner), packet, discoveries, evidenceVersion: packet.evidenceVersion, promptVersion: PROMPT_VERSION, schemaVersion: SCHEMA_VERSION, createdAt: now, expiresAt: now + 86_400_000 };
 await redis.set(prefix(owner, id), stored, { ex: 86_400 });
 return { ...bundle, packetId: id };
}
export async function loadPacket(owner: string, id: string): Promise<StoredPacket | null> {
 const stored = await client().get<StoredPacket>(prefix(owner, id));
 if (!stored || stored.ownerDigest !== ownerDigest(owner) || stored.id !== id) return null;
 if (stored.promptVersion !== PROMPT_VERSION || stored.schemaVersion !== SCHEMA_VERSION || stored.expiresAt <= Date.now()) throw new Error('Packet expired');
 if (!stored.packet?.documents || stored.evidenceVersion !== stored.packet.evidenceVersion || !Array.isArray(stored.discoveries)) throw new Error('Invalid stored packet');
 const known = new Set(stored.packet.documents.filter(d => d.role === 'foundation').map(d => d.source.id));
 if (parseDiscoveries(stored.discoveries, known).length !== stored.discoveries.length) throw new Error('Invalid stored discoveries');
 return stored;
}
type CheckedResult = Extract<LessonResponse, { status: 'complete' }> | { status: 'insufficient'; message: string };
type Envelope = { supportRecords: SupportRecord[]; owner: string; packetId: string; discoveryId: string; version: string; evidenceVersion: string; expiresAt: number; result: CheckedResult };
function validResult(result: CheckedResult, discovery: string): boolean {
 return result?.status === 'insufficient' || (result?.status === 'complete' && result.lesson?.discoveryId === discovery && Array.isArray(result.sources) && !!parseLesson(result.lesson, new Set(result.sources.map(s => s.id))));
}
export async function getLesson(owner: string, id: string, discovery: string): Promise<LessonResponse | null> {
 const stored = await loadPacket(owner, id);
 if (!stored || !stored.discoveries.some(d => d.id === discovery)) return null;
 const envelope = await client().get<Envelope>(lessonKey(owner, id, discovery));
 if (!envelope || envelope.owner !== ownerDigest(owner) || envelope.packetId !== id || envelope.discoveryId !== discovery || envelope.version !== PROMPT_VERSION || envelope.evidenceVersion !== stored.evidenceVersion || envelope.expiresAt <= Date.now() || !validResult(envelope.result, discovery)) return null;
 return envelope.result;
}
export async function claimLesson(owner: string, id: string, discovery: string): Promise<string | null> {
 const token = randomUUID();
 return await client().set(claimKey(owner, id, discovery), token, { nx: true, ex: 90 }) === 'OK' ? token : null;
}
export async function releaseLesson(owner: string, id: string, discovery: string, token: string): Promise<void> {
 await client().eval(RELEASE, [claimKey(owner, id, discovery)], [token]);
}
export async function publishLesson(owner: string, id: string, discovery: string, token: string, result: CheckedResult, supportRecords: SupportRecord[] = []): Promise<boolean> {
 const stored = await loadPacket(owner, id);
 if (!stored || !stored.discoveries.some(d => d.id === discovery) || !validResult(result, discovery)) return false;
 const ttl = Math.floor((stored.expiresAt - Date.now()) / 1000);
 if (ttl <= 0) return false;
 const envelope: Envelope = { supportRecords, owner: ownerDigest(owner), packetId: id, discoveryId: discovery, version: PROMPT_VERSION, evidenceVersion: stored.evidenceVersion, expiresAt: stored.expiresAt, result };
 return await client().eval(PUBLISH, [claimKey(owner, id, discovery), lessonKey(owner, id, discovery)], [token, JSON.stringify(envelope), ttl]) === 1;
}
