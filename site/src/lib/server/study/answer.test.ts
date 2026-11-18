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
});
