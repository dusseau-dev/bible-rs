import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { StudyRequest, StudyResult } from '#lib/read/study.js';
import { generateStudy } from '#lib/server/study/answer.js';
import { localEvidence, passageFrom, passageLabel, passageVideos, verifiedPassageVideos } from '#lib/server/study/evidence.js';
import { allowDiscovery, allowStudy, allowVideoRefresh } from '#lib/server/study/limits.js';
import { discover } from '#lib/server/study/research.js';
import { buildGuide } from '#lib/server/study/guide.js';
import { discoverTestimonials, mergeTestimonials, reviewedTestimonials } from '#lib/server/study/community.js';

export const prerender = false;

const headers = { 'cache-control': 'no-store', 'x-robots-tag': 'noindex' };
const fail = (status: number, error: string) => json({ error }, { status, headers });

export const POST: RequestHandler = async ({ request, getClientAddress, url }) => {
	const origin = request.headers.get('origin');
	if (origin && origin !== url.origin) return fail(403, 'Cross-site study requests are not allowed');
	if (!request.headers.get('content-type')?.startsWith('application/json')) return fail(415, 'Expected JSON');
	const body = await request.text();
	if (body.length > 8_000) return fail(413, 'The request is too large');
	let input: Partial<StudyRequest>;
	try {
		input = JSON.parse(body) as Partial<StudyRequest>;
	} catch {
		return fail(400, 'Invalid request');
	}
	const passage = passageFrom(input?.passage);
	if (!passage || !['open', 'ask', 'explain'].includes(input.mode ?? '') || !['standard', 'simple'].includes(input.style ?? ''))
		return fail(400, 'Invalid passage or study option');
	if (input.openaiKey !== undefined && (typeof input.openaiKey !== 'string' || input.openaiKey.length > 256))
		return fail(400, 'Invalid API key');
	if (input.question !== undefined && (typeof input.question !== 'string' || input.question.length > 500))
		return fail(400, 'Question is too long');
	if (input.mode === 'ask' && !input.question?.trim()) return fail(400, 'Enter a question');
	let client = 'unknown';
	try { client = getClientAddress(); } catch { /* local preview */ }
	if (!(await allowStudy(client))) return fail(429, 'Too many study requests. Try again later.');

	let local: Awaited<ReturnType<typeof localEvidence>>;
	try {
		local = await localEvidence(passage);
	} catch {
		return fail(400, 'That passage could not be loaded');
	}
	const youtubeKey = process.env.YOUTUBE_API_KEY?.trim();
	const refreshVideo = youtubeKey && passageVideos(passage).length > 0 && await allowVideoRefresh();
	const result: StudyResult = {
		reference: passageLabel(passage),
		passageText: local.passageText,
		contextText: local.contextText,
		sources: local.sources,
		terms: local.terms,
		claims: [],
		videos: await verifiedPassageVideos(passage, refreshVideo ? youtubeKey : undefined),
		guide: buildGuide([], local.sources),
		testimonials: reviewedTestimonials(passage),
		answer: null
	};
	const exaKey = process.env.EXA_API_KEY?.trim();
	if (exaKey && await allowDiscovery(client)) {
		const [research, community] = await Promise.allSettled([discover(passage, exaKey), discoverTestimonials(passage, exaKey)]);
		if (research.status === 'fulfilled') result.sources.push(...research.value);
		if (community.status === 'fulfilled') result.testimonials = mergeTestimonials(result.testimonials, community.value);
	}
	const openaiKey = input.openaiKey?.trim();
	if (openaiKey) {
		try {
			const generated = await generateStudy({
				passage,
				contextText: local.contextText,
				sources: result.sources,
				terms: local.terms,
				style: input.style!,
					question: input.mode === 'ask' ? input.question?.trim() : input.mode === 'explain' ? 'Explain this passage using the reading path and its cited evidence.' : undefined,
				key: openaiKey
			});
			result.claims = generated.claims;
			result.answer = generated.answer;
			result.guide = generated.guide;
		} catch (error) {
			result.message = error instanceof Error ? error.message : 'The AI summary is unavailable right now';
		}
	} else {
		result.message = input.mode === 'ask'
			? 'Add your OpenAI API key to ask a question.'
			: 'Add your OpenAI API key for an evidence-linked summary. Sources and language data are available below.';
	}
	return json(result, { headers });
};
