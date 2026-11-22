import { afterEach, describe, expect, it, vi } from 'vitest';
import type { StudySource } from '#lib/read/study.js';
import { generateStudy, validateGenerated } from './answer';

const sources: StudySource[] = [
	{ id: 'text', title: 'WEB', author: 'WEB', kind: 'scripture', tradition: null, scope: 'direct', url: '/read/web', location: 'John 3:16', license: 'Public domain', excerpt: '' },
	{ id: 'henry', title: 'Henry', author: 'Matthew Henry', kind: 'commentary', tradition: 'protestant', scope: 'direct', url: 'https://ccel.org', location: 'John 3', license: 'Public domain', excerpt: 'Henry explains the passage in relation to the promise of eternal life.' }
];

describe('generated claim validation', () => {
	afterEach(() => vi.unstubAllGlobals());
	it('drops unsupported claims and mismatched tradition labels', () => {
		const out = validateGenerated({ claims: [
			{ layer: 'history', text: 'Unknown history', sourceIds: ['text'], tradition: 'none' },
			{ layer: 'interpretation', text: 'Unsupported Catholic interpretation', sourceIds: ['henry'], tradition: 'catholic' },
			{ layer: 'interpretation', text: 'Henry interpretation', sourceIds: ['henry'], tradition: 'protestant' },
			{ layer: 'text', text: 'Invented source', sourceIds: ['missing'], tradition: 'none' }
		], answer: { text: 'Uncited', sourceIds: ['missing'] } }, sources);
		expect(out.claims.map((claim) => claim.text)).toEqual(['Henry interpretation']);
		expect(out.answer).toBeNull();
	});

	it('keeps reading prompts while rejecting an uncited Christ connection', () => {
		const out = validateGenerated({
			claims: [], answer: { text: '', sourceIds: [] },
			guide: [
				{ id: 'observe', answer: 'The verse names fig leaves.', sourceIds: ['text'] },
				{ id: 'christ', answer: 'This directly predicts the cross.', sourceIds: ['text'], connection: 'explicit' }
			]
		}, sources);
		expect(out.guide[0].answer).toBe('The verse names fig leaves.');
		expect(out.guide[3].answer).toBeNull();
	});

	it('ignores malformed JSON fields from providers without strict schema output', () => {
		const out = validateGenerated({ claims: {} as never, guide: [{ id: 'observe', answer: 'Text', sourceIds: 'text' as never }] }, sources);
		expect(out.claims).toEqual([]);
		expect(out.guide[0].answer).toBeNull();
	});

	it('requests a non-stored structured answer and accepts only cited output', async () => {
		const mock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
			output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({
				claims: [{ layer: 'interpretation', text: 'Henry reads this as reassurance.', sourceIds: ['henry'], tradition: 'protestant' }],
				answer: { text: 'The cited commentary reads it as reassurance.', sourceIds: ['henry'] }
			}) }] }]
		}), { status: 200 }));
		vi.stubGlobal('fetch', mock);
		const out = await generateStudy({
			passage: { book: 42, chapter: 3, firstVerse: 16, lastVerse: 16 },
			contextText: '16 Public domain verse.', sources, terms: [], style: 'simple', question: 'What does Henry say?', key: 'test-key'
		});
		expect(out.claims).toHaveLength(1);
		expect(out.answer?.sourceIds).toEqual(['henry']);
		const request = JSON.parse(mock.mock.calls[0][1].body);
		expect(request.store).toBe(false);
		expect(request.text.format.type).toBe('json_schema');
		expect(mock.mock.calls[0][1].headers.authorization).toBe('Bearer test-key');
	});

	it('uses CheaperInference Chat Completions for its API keys', async () => {
		const mock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
			choices: [{ message: { content: JSON.stringify({
				claims: [{ layer: 'interpretation', text: 'Henry reads this as reassurance.', sourceIds: ['henry'], tradition: 'protestant' }],
				answer: { text: 'The cited commentary reads it as reassurance.', sourceIds: ['henry'] },
				guide: []
			}) } }]
		}), { status: 200 }));
		vi.stubGlobal('fetch', mock);
		const out = await generateStudy({
			passage: { book: 42, chapter: 3, firstVerse: 16, lastVerse: 16 },
			contextText: '16 Public domain verse.', sources, terms: [], style: 'simple', key: 'ci_live_test'
		});
		expect(out.answer?.sourceIds).toEqual(['henry']);
		expect(mock.mock.calls[0][0]).toBe('https://api.cheaperinference.com/v1/chat/completions');
		const request = JSON.parse(mock.mock.calls[0][1].body);
		expect(request.model).toBe('gpt-5-mini');
		expect(request.response_format).toEqual({ type: 'json_object' });
		expect(request.messages[0].content).toContain('Return a JSON object');
		expect(mock.mock.calls[0][1].headers.authorization).toBe('Bearer ci_live_test');
	});
});
