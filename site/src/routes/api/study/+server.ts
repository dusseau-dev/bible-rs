import { json } from '@sveltejs/kit';
import { readBody } from '#lib/server/body.js';
import { CHEAPERINFERENCE_API_KEY, OPENAI_API_KEY } from '$app/env/private';
import type { RequestHandler } from './$types';
import type { DiscoveryResult, StudyRequest, StudyResult, StudySource, StudyTestimonial } from '#lib/read/study.js';
import { generateStudy } from '#lib/server/study/answer.js';
import { localEvidence, passageFrom, passageLabel, passageVideos, verifiedPassageVideos } from '#lib/server/study/evidence.js';
import { allowAi, allowDiscovery, allowStudy, allowVideoRefresh } from '#lib/server/study/limits.js';
import { discover } from '#lib/server/study/research.js';
import { buildGuide } from '#lib/server/study/guide.js';
import { discoverTestimonials, mergeTestimonials, reviewedTestimonials } from '#lib/server/study/community.js';
import { passagePapers, reviewedPapers } from '#lib/server/study/academic.js';
import { discoverPassageVideos, mergeVideos } from '#lib/server/study/youtube.js';

export const prerender = false;

const headers = { 'cache-control': 'no-store', 'x-robots-tag': 'noindex' };
const fail = (status: number, error: string) => json({ error }, { status, headers });

export const POST: RequestHandler = async ({ request, getClientAddress, url }) => {
	const origin = request.headers.get('origin');
	if (origin && origin !== url.origin) return fail(403, 'Cross-site study requests are not allowed');
	if (!request.headers.get('content-type')?.startsWith('application/json')) return fail(415, 'Expected JSON');
	const body = await readBody(request, 8_000);
	if (body === null) return fail(413, 'The request is too large');
	let input: Partial<StudyRequest>;
	try {
		input = JSON.parse(body) as Partial<StudyRequest>;
	} catch {
		return fail(400, 'Invalid request');
	}
	const passage = passageFrom(input?.passage);
	if (!passage || !['open', 'ask', 'explain'].includes(input.mode ?? '') || !['standard', 'simple'].includes(input.style ?? ''))
		return fail(400, 'Invalid passage or study option');
	if ([input.aiKey, input.openaiKey].some((key) => key !== undefined && (typeof key !== 'string' || key.length > 256)))
		return fail(400, 'Invalid API key');
	if (input.question !== undefined && (typeof input.question !== 'string' || input.question.length > 500))
		return fail(400, 'Question is too long');
	if (input.mode === 'ask' && !input.question?.trim()) return fail(400, 'Enter a question');
	let client = 'unknown';
	try { client = getClientAddress(); } catch { /* local preview */ }
	const studyPermission = await allowStudy(client);
	if (studyPermission === 'rate_limited') return fail(429, 'Too many study requests. Try again later.');
	if (studyPermission !== 'allowed') return fail(503, 'Study is temporarily unavailable. Try again later.');

	let local: Awaited<ReturnType<typeof localEvidence>>;
	try {
		local = await localEvidence(passage);
	} catch {
		return fail(400, 'That passage could not be loaded');
	}
	const youtubeKey = process.env.YOUTUBE_API_KEY?.trim();
	const reviewedVideos = passageVideos(passage);
	const refreshVideo = youtubeKey && reviewedVideos.length > 0 && await allowVideoRefresh();
	const exaKey = process.env.EXA_API_KEY?.trim();
	const exaPermission = exaKey ? await allowDiscovery(client) : 'disabled';
	const searchExa = exaPermission === 'allowed';
	const discovery: NonNullable<StudyResult['discovery']> = { sources: 'failed', testimonials: 'failed', papers: 'failed', videos: 'failed' };
	const result: StudyResult = {
		discovery,
		reference: passageLabel(passage),
		passageText: local.passageText,
		contextText: local.contextText,
		sources: local.sources,
		terms: local.terms,
		claims: [],
		videos: reviewedVideos,
		papers: reviewedPapers(passage),
		guide: buildGuide([], local.sources),
		testimonials: reviewedTestimonials(passage),
		answer: null
	};
	const [verified, research, community, papers, videos] = await Promise.allSettled([
		verifiedPassageVideos(passage, refreshVideo ? youtubeKey : undefined),
		searchExa ? discover(passage, exaKey!).then(items => ({ items, status: 'complete' as const })) : Promise.resolve<DiscoveryResult<StudySource>>({ items: [], status: exaPermission as Exclude<typeof exaPermission, 'allowed'> }),
		searchExa ? discoverTestimonials(passage, exaKey!) : Promise.resolve<DiscoveryResult<StudyTestimonial>>({ items: [], status: exaPermission as Exclude<typeof exaPermission, 'allowed'> }),
		passagePapers(passage, process.env.OPENALEX_API_KEY?.trim(), client),
		discoverPassageVideos(passage, youtubeKey, client)
	]);
	if (verified.status === 'fulfilled') result.videos = verified.value;
	if (research.status === 'fulfilled') { result.sources.push(...research.value.items); discovery.sources = research.value.status; }
	if (community.status === 'fulfilled') { result.testimonials = mergeTestimonials(result.testimonials, community.value.items); discovery.testimonials = community.value.status; }
	if (papers.status === 'fulfilled') { result.papers = papers.value.items; discovery.papers = papers.value.status; }
	if (videos.status === 'fulfilled') { result.videos = mergeVideos(result.videos, videos.value.items); discovery.videos = videos.value.status; }
	const aiKey = CHEAPERINFERENCE_API_KEY?.trim() || OPENAI_API_KEY?.trim() || input.aiKey?.trim() || input.openaiKey?.trim();
	if (aiKey && await allowAi()) {
		try {
			const generated = await generateStudy({
				passage,
				contextText: local.contextText,
				sources: result.sources,
				terms: local.terms,
				style: input.style!,
					question: input.mode === 'ask' ? input.question?.trim() : input.mode === 'explain' ? 'Explain this passage using the reading path and its cited evidence.' : undefined,
				key: aiKey
			});
			result.claims = generated.claims;
			result.answer = generated.answer;
			result.guide = generated.guide;
			if (generated.message) result.message = generated.message;
		} catch {
			result.message = 'The AI summary is unavailable right now. Sources and language data are still available.';
		}
	} else {
		result.message = input.mode === 'ask'
			? 'Answers are unavailable right now. Try again later.'
			: 'AI explanations are unavailable right now. Sources and language data are still available.';
	}
	return json(result, { headers });
};
