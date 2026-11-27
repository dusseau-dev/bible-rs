import { afterEach, describe, expect, it, vi } from 'vitest';
import type { StudySource } from '#lib/read/study.js';
import { generateStudy, validateGenerated } from './answer';

const sources: StudySource[] = [
	{ id: 'text', title: 'WEB', author: 'WEB', kind: 'scripture', tradition: null, scope: 'direct', url: '/read/web', location: 'John 3:16', license: 'Public domain', excerpt: '' },
	{ id: 'henry', title: 'Henry', author: 'Matthew Henry', kind: 'commentary', tradition: 'protestant', scope: 'direct', url: 'https://ccel.org', location: 'John 3', license: 'Public domain', excerpt: 'Henry explains the passage in relation to the promise of eternal life.' }
];
const providerResponse = (content: unknown) => new Response(JSON.stringify({
	output_text: JSON.stringify(content), choices: [{ message: { content: JSON.stringify(content) } }]
}));
const keepHenry = () => providerResponse({ assessments: [{ index:0, keep:true, historical:false, sourceId:'henry', quote:sources[1].excerpt }] });

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

	it('keeps cited history facts, capped so they cannot crowd out other claims', () => {
		const withNote: StudySource[] = [...sources, { id: 'note', title: 'Mark 1:21–28', author: 'Aquifer', kind: 'study_note', tradition: null, scope: 'related', url: 'https://github.com', location: 'Mark 1:21–28', license: 'CC BY-SA 4.0', excerpt: 'Capernaum was a fishing village on the Sea of Galilee.' }];
		const facts = Array.from({ length: 14 }, (_, i) => ({ layer: 'history', text: `Fact ${i}`, sourceIds: ['note'], tradition: 'none' }));
		const out = validateGenerated({ claims: [...facts, { layer: 'interpretation', text: 'Henry interpretation', sourceIds: ['henry'], tradition: 'protestant' }] }, withNote);
		expect(out.claims.filter((claim) => claim.layer === 'history')).toHaveLength(10);
		expect(out.claims.at(-1)?.text).toBe('Henry interpretation');
	});

	it('drops history facts confirmed only by Scripture or word data', () => {
		const withWords: StudySource[] = [...sources, { id: 'step', title: 'STEPBible', author: 'STEPBible', kind: 'language_data', tradition: null, scope: 'direct', url: 'https://github.com', location: 'Mark 6:17', license: 'CC BY 4.0', excerpt: 'δέω (deō): bind' }];
		const out = validateGenerated({ claims: [
			{ layer: 'history', text: 'Herod bound John.', sourceIds: ['text', 'step'], tradition: 'none' },
			{ layer: 'history', text: 'Henry places the passage in context.', sourceIds: ['henry'], tradition: 'none' }
		] }, withWords);
		expect(out.claims.map((claim) => claim.text)).toEqual(['Henry places the passage in context.']);
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
		const mock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({
			output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({
				claims: [{ layer: 'interpretation', text: 'Henry reads this as reassurance.', sourceIds: ['henry'], tradition: 'protestant' }],
				answer: { text: 'The cited commentary reads it as reassurance.', sourceIds: ['henry'] }
			}) }] }]
		}), { status: 200 })).mockResolvedValueOnce(keepHenry());
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
		const mock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({
			choices: [{ message: { content: JSON.stringify({
				claims: [{ layer: 'interpretation', text: 'Henry reads this as reassurance.', sourceIds: ['henry'], tradition: 'protestant' }],
				answer: { text: 'The cited commentary reads it as reassurance.', sourceIds: ['henry'] },
				guide: []
			}) } }]
		}), { status: 200 })).mockResolvedValueOnce(keepHenry());
		vi.stubGlobal('fetch', mock);
		const out = await generateStudy({
			passage: { book: 42, chapter: 3, firstVerse: 16, lastVerse: 16 },
			contextText: '16 Public domain verse.', sources, terms: [], style: 'simple', key: 'ci_live_test'
		});
		expect(out.answer?.sourceIds).toEqual(['henry']);
		expect(out.claims).toHaveLength(1);
		expect(mock.mock.calls[0][0]).toBe('https://api.cheaperinference.com/v1/chat/completions');
		const request = JSON.parse(mock.mock.calls[0][1].body);
		expect(request.model).toBe('gpt-5.4-mini');
		expect(request.max_tokens).toBe(4000);
		expect(request.response_format).toEqual({ type: 'json_object' });
		expect(request.messages[0].content).toContain('Return a JSON object');
		for (const focus of ['land, climate, water', 'money, and taxation', 'relations between states', 'everyday life', 'education, and art', 'transport, communication'])
			expect(request.messages[0].content).toContain(focus);
		expect(mock.mock.calls[0][1].headers.authorization).toBe('Bearer ci_live_test');
	});
});

describe('history evidence verification', () => {
 afterEach(() => vi.unstubAllGlobals());
 const note: StudySource = { id: 'note', title: 'Study note', author: 'Aquifer', kind: 'study_note', tradition: null, scope: 'context', url: 'https://example.org/note', location: 'Ezra 1:1', license: 'CC BY-SA 4.0', excerpt: 'Cyrus ruled Persia from 559 to 530 BC. God remains in control of rulers and nations.' };
 const claims = [
  { layer: 'history', text: 'Cyrus ruled Persia from 559 to 530 BC.', sourceIds: ['note'], tradition: 'none' },
  { layer: 'history', text: 'God remains in control of rulers and nations.', sourceIds: ['note'], tradition: 'none' }
 ];
 const response = (content: unknown) => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }));
 it('keeps only history claims independently classified as historical and supported by an exact source quote', async () => {
  vi.stubGlobal('fetch', vi.fn()
   .mockResolvedValueOnce(response({ claims, guide: [] }))
   .mockResolvedValueOnce(response({ assessments: [
    { index: 0, keep: true, historical: true, sourceId: 'note', quote: 'Cyrus ruled Persia from 559 to 530 BC.' },
    { index: 1, keep: true, historical: false, sourceId: 'note', quote: 'God remains in control of rulers and nations.' }
   ] })));
  const out = await generateStudy({ passage: { book: 14, chapter: 1, firstVerse: 1, lastVerse: 1 }, contextText: '', sources: [note], terms: [], style: 'standard', key: 'ci_live_test' });
  expect(out.claims.map(claim => claim.text)).toEqual([claims[0].text]);
 });
 it.each([
  [{ index: 0, keep: true, historical: true, sourceId: 'note', quote: 'A quote invented by the reviewer.' }],
  [{ index: 0, keep: true, historical: true, sourceId: 'missing', quote: note.excerpt }],
  [{ index: 0, keep: true, historical: 'true', sourceId: 'note', quote: note.excerpt }],
  [{ index: 0, keep: true, historical: true, sourceId: 'note', quote: note.excerpt }, { index: 0, keep: false, historical: false }],
  []
 ].map(assessments => [assessments]))('rejects unverifiable or ambiguous history assessments: %j', async assessments => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response({ claims: [claims[0]], guide: [] }))
   .mockResolvedValueOnce(response({ assessments })));
  const out = await generateStudy({ passage: { book: 14, chapter: 1, firstVerse: 1, lastVerse: 1 }, contextText: '', sources: [note], terms: [], style: 'standard', key: 'ci_live_test' });
  expect(out.claims).toEqual([]);
 });
 it('shares one time budget across generation and verification', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(response({ claims: [claims[0]], guide: [] }))
   .mockResolvedValueOnce(response({ assessments: [{ index: 0, keep: true, historical: true, sourceId: 'note', quote: claims[0].text }] }));
  vi.stubGlobal('fetch', fetcher);
  const out = await generateStudy({ passage: { book: 14, chapter: 1, firstVerse: 1, lastVerse: 1 }, contextText: '', sources: [note], terms: [], style: 'standard', key: 'ci_live_test' });
  expect(out.claims).toHaveLength(1);
  expect(fetcher.mock.calls[1][1].signal).toBe(fetcher.mock.calls[0][1].signal);
 });
});

describe('insight editing', () => {
	afterEach(() => vi.unstubAllGlobals());
	const note: StudySource = { ...sources[1], id:'note', kind:'study_note', tradition:null, excerpt:'The word elohim is plural in form, but it usually takes singular verbs. This verse provides context for the summary and the detailed creation account.' };
	const args = { passage:{book:0,chapter:1,firstVerse:1,lastVerse:2}, contextText:'', sources:[note], terms:[], style:'standard' as const, key:'ci_live_test' };
	it('reviews hooks and explanations together, keeping a grounded detail while dropping summary and repetition', async () => {
		const fetcher = vi.fn().mockResolvedValueOnce(providerResponse({ claims:[
			{layer:'language',title:'Why does a plural name take a singular verb?',text:'The plural form does not by itself determine the number of actors; the verb supplies grammatical evidence.',sourceIds:['note'],tradition:'none'},
			{layer:'interpretation',title:'Who created the world?',text:'Genesis says that God created the world.',sourceIds:['note'],tradition:'none'}
		],guide:[{id:'contextualize',title:'Many gods in one name?',answer:'Elohim is plural in form but takes singular verbs.',sourceIds:['note']}] }))
		.mockResolvedValueOnce(providerResponse({assessments:[
			{index:0,keep:true,titleSupported:true,historical:false,sourceId:'note',quote:'The word elohim is plural in form, but it usually takes singular verbs.'},
			{index:1,keep:false,historical:false,sourceId:'',quote:''},
			{index:3,keep:false,historical:false,sourceId:'',quote:''}
		]}));
		vi.stubGlobal('fetch',fetcher);
		const out=await generateStudy(args);
		expect(out.claims).toHaveLength(1);
		expect(out.claims[0].title).toBe('Why does a plural name take a singular verb?');
		expect(out.guide.every(step => !step.answer)).toBe(true);
		const review=JSON.parse(fetcher.mock.calls[1][1].body);
		expect(JSON.parse(review.messages[1].content).notes).toHaveLength(3);
		expect(fetcher.mock.calls[1][1].signal).toBe(fetcher.mock.calls[0][1].signal);
	});
	it.each([
		{index:0,keep:true,titleSupported:true,historical:false,sourceId:'note',quote:'A made-up source quotation of sufficient length.'},
		{index:0,keep:'true',titleSupported:true,historical:false,sourceId:'note',quote:note.excerpt},
		{index:0,keep:true,titleSupported:true,historical:false,sourceId:'uncited',quote:note.excerpt},
		{index:0,keep:true,titleSupported:false,historical:false,sourceId:'note',quote:note.excerpt},
		{index:0,keep:true,historical:false,sourceId:'note',quote:note.excerpt}
	])('requires an unambiguous editorial decision and a real cited quote: %j', async verdict => {
		vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(providerResponse({claims:[{layer:'language',title:'A hook',text:'A candidate note.',sourceIds:['note']}]}))
			.mockResolvedValueOnce(providerResponse({assessments:[verdict]})));
		expect((await generateStudy(args)).claims).toEqual([]);
	});
	it('falls back to sources if independent review fails instead of publishing unchecked hooks', async () => {
		vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(providerResponse({claims:[{layer:'language',title:'A hook',text:'A candidate note.',sourceIds:['note']}]}))
			.mockRejectedValueOnce(new Error('Unavailable')));
		const out=await generateStudy(args);
		expect(out.claims).toEqual([]);
		expect(out.message).toContain('Source excerpts are still available');
	});
});
