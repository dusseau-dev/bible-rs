import { json } from '@sveltejs/kit';
import { CHEAPERINFERENCE_API_KEY, OPENAI_API_KEY } from '$app/env/private';
import type { RequestHandler } from './$types';
import { readBody } from '#lib/server/body.js';
import { passageFrom } from '#lib/server/study/evidence.js';
import { allowLessonStatus, allowStudy } from '#lib/server/study/limits.js';
import { loadPacket, getLesson, claimLesson, publishLesson, releaseLesson } from '#lib/server/study/lesson-store.js';
import { composeLesson } from '#lib/server/study/lesson.js';
export const prerender = false;
export const config = { maxDuration: 90 };
const headers = { 'cache-control': 'private, no-store', 'x-robots-tag': 'noindex' };
const response = (status: number, state: string, message: string) => json({ status: state, message }, { status, headers: { ...headers, ...(status === 202 ? { 'retry-after': '2' } : status === 429 ? { 'retry-after': '60' } : {}) } });
const unavailable = () => response(503, 'unavailable', 'This lesson is unavailable right now. Try again later.');
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export const POST: RequestHandler = async ({ request, url, locals, getClientAddress }) => {
 const owner = locals.ownerEmail;
 if (!owner) return response(401, 'unavailable', 'Sign in to read this lesson.');
 const origin = request.headers.get('origin');
 if (origin && origin !== url.origin) return response(403, 'unavailable', 'Cross-site requests are not allowed.');
 if (!request.headers.get('content-type')?.startsWith('application/json')) return response(415, 'unavailable', 'Expected JSON.');
 const body = await readBody(request, 2000);
 if (body === null) return response(413, 'unavailable', 'The request is too large.');
 let input;
 try { input = JSON.parse(body); } catch { return response(400, 'unavailable', 'Invalid request.'); }
 const passage = passageFrom(input?.passage);
 if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(k => !['packetId', 'discoveryId', 'passage'].includes(k)) || typeof input.packetId !== 'string' || typeof input.discoveryId !== 'string' || !uuid.test(input.packetId) || !uuid.test(input.discoveryId) || !passage || Object.keys(input.passage).some(k => !['book', 'chapter', 'firstVerse', 'lastVerse'].includes(k))) return response(400, 'unavailable', 'Invalid request.');
 const { packetId, discoveryId } = input;
 let token: string | null = null;
 try {
  const statusLimit = await allowLessonStatus(owner);
  if (statusLimit === 'rate_limited') return response(429, 'unavailable', 'Too many lesson requests. Try again in a minute.');
  if (statusLimit !== 'allowed') return unavailable();
  const stored = await loadPacket(owner, packetId);
  const discovery = stored?.discoveries.find(d => d.id === discoveryId);
  if (!stored || !discovery) return response(404, 'expired', 'This discovery is unavailable. Refresh this passage’s discoveries.');
  if (JSON.stringify(stored.packet.passage) !== JSON.stringify(passage)) return response(400, 'unavailable', 'The passage does not match this discovery.');
  const cached = await getLesson(owner, packetId, discoveryId);
  if (cached) return json(cached, { headers });
  token = await claimLesson(owner, packetId, discoveryId);
  if (!token) return response(202, 'pending', 'This lesson is being prepared.');
  const completed = await getLesson(owner, packetId, discoveryId);
  if (completed) return json(completed, { headers });
  let address = owner;
  try { address = getClientAddress(); } catch { /* Authenticated owner is the local fallback. */ }
  const grant = await allowStudy(address);
  if (grant === 'rate_limited') return response(429, 'unavailable', 'Too many study requests. Try again later.');
  if (grant !== 'allowed') return unavailable();
  const key = CHEAPERINFERENCE_API_KEY?.trim() || OPENAI_API_KEY?.trim();
  if (!key) return unavailable();
  const composed = await composeLesson(stored.packet, discovery, address, key, process.env.EXA_API_KEY?.trim(), AbortSignal.any([request.signal, AbortSignal.timeout(75_000)]));
  const { supportRecords, ...result } = composed;
  if (result.status !== 'complete' && result.status !== 'insufficient') return unavailable();
  if (!await publishLesson(owner, packetId, discoveryId, token, result, supportRecords)) return unavailable();
  return json(result, { headers });
 } catch (error) {
  return error instanceof Error && error.message === 'Packet expired' ? response(410, 'expired', 'This research has expired. Refresh this passage’s discoveries.') : unavailable();
 } finally {
  if (token) { try { await releaseLesson(owner, packetId, discoveryId, token); } catch { /* The 90-second lease expires if storage is unavailable. */ } }
 }
};
