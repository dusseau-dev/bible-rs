import { describe, expect, it } from 'vitest';
import { itemsFrom } from './study-items';
import type { StudyResult, StudySource } from './study';

const source: StudySource = { id: 'note', title: 'John 3:8', author: 'Aquifer', kind: 'study_note', scope: 'related', tradition: null, url: 'https://example.org/note', location: 'John 3:8', license: 'CC BY-SA 4.0', excerpt: 'In Greek, the word for wind is the same as for spirit.' };
const result = (changes: Partial<StudyResult> = {}): StudyResult => ({ reference: 'John 3:16', passageText: '', contextText: '', sources: [source], terms: [], claims: [], guide: [], testimonials: [], papers: [], videos: [], answer: null, ...changes });

describe('study note presentation', () => {
 it('places related Scripture and traced connections in Related with their source labels', () => {
  const items = itemsFrom(result({ sources:[{...source, id:'scripture',kind:'scripture',excerpt:'A related passage.'}], guide:[{id:'trace', question:'',answer:'An echo in Scripture.',sourceIds:['scripture']}] }));
  expect(items).toHaveLength(1);
  expect(items.every(item => item.category === 'related' && item.scope === 'related')).toBe(true);
  expect(items.find(item => item.text === 'An echo in Scripture.')?.meta).toBe('Related background');
 });
 it('does not classify related word meanings as History', () => {
  expect(itemsFrom(result())[0]).toMatchObject({ category: 'academic', scope: 'related' });
 });
 it('qualifies generated claims and guide steps with their supporting scope', () => {
  const items = itemsFrom(result({ claims: [{ layer: 'history', text: 'Background fact', sourceIds: ['note'], tradition: null }], guide: [{ id: 'contextualize', question: '', answer: 'Literary context', sourceIds: ['note'] }] }));
  expect(items.find(i => i.text === 'Background fact')).toMatchObject({ scope: 'related', meta: 'Related background' });
  expect(items.find(i => i.text === 'Literary context')).toMatchObject({ category: 'academic', scope: 'related' });
 });
 it('does not upgrade mixed supporting scopes to direct evidence', () => {
  const items = itemsFrom(result({ sources: [source, { ...source, id: 'direct', scope: 'direct' }], claims: [{ layer: 'language', text: 'Mixed claim', sourceIds: ['direct', 'note'], tradition: null }] }));
  expect(items.find(i => i.text === 'Mixed claim')?.scope).toBe('related');
 });
 it('keeps explicit historical records in History and deduplicates source links', () => {
  const items = itemsFrom(result({ sources: [source, { ...source, id: 'record', kind: 'historical_record', excerpt: 'A historical artifact.' }], claims: [{ layer: 'language', text: 'Word meaning', sourceIds: ['note', 'note'], tradition: null }] }));
  expect(items.find(i => i.text === 'A historical artifact.')?.category).toBe('history');
  expect(items.find(i => i.text === 'Word meaning')?.links).toHaveLength(1);
 });
});

it('shows the hook and explanation once, with the source credit rather than another source summary', () => {
 const items = itemsFrom(result({ claims: [{ layer: 'language', title: 'One word, two possible readings?', text: 'The same Greek word can name wind or spirit; its context determines the reading.', sourceIds: ['note'], tradition: null }] }));
 expect(items).toHaveLength(1);
 expect(items[0]).toMatchObject({ title: 'One word, two possible readings?', attribution: 'Aquifer · CC BY-SA 4.0' });
 expect(items[0].links[0].url).toBe(source.url);
 expect(items[0].text).not.toBe(source.excerpt);
});

it('does not pad an edited study with unused source summaries', () => {
 const items = itemsFrom(result({ sources: [source, {...source, id:'unused', excerpt:'A generic summary.'}], claims: [{ layer:'language', title:'A grammatical puzzle', text:'A distinct explanation.', sourceIds:['note'], tradition:null }] }));
 expect(items.map(item => item.text)).toEqual(['A distinct explanation.']);
});

it('keeps a first-principles textual insight instead of also listing its generic context summary', () => {
 const items = itemsFrom(result({ claims:[{layer:'text',title:'A heading or a first event?',text:'The opening can frame the account that follows.',sourceIds:['note'],tradition:null}], guide:[{id:'contextualize',question:'',answer:'The opening summarizes creation.',sourceIds:['note']}] }));
 expect(items).toHaveLength(1);
 expect(items[0]).toMatchObject({title:'A heading or a first event?',kind:'Text & structure'});
});

it('does not label a passage paraphrase as an echo without another Scripture source', () => {
 const items = itemsFrom(result({ guide: [{ id:'trace', question:'', title:'An apparent echo', answer:'God brings order out of chaos.', sourceIds:['note'] }] }));
 expect(items.some(item => item.kind === 'Echoes in Scripture')).toBe(false);
});

it('merges repeated text despite case or punctuation while preserving both citations', () => {
 const items = itemsFrom(result({ sources:[source,{...source,id:'second',url:'https://example.org/second'}], claims:[
  {layer:'language',text:'A shared observation.',sourceIds:['note'],tradition:null},
  {layer:'interpretation',text:'A shared observation!',sourceIds:['second'],tradition:null}
 ] }));
 expect(items).toHaveLength(1);
 expect(items[0].links).toHaveLength(2);
});

it('keeps the source license beside a displayed excerpt', () => {
 const item = itemsFrom(result()).find(item => item.text === source.excerpt);
 expect(item?.meta).toContain('CC BY-SA 4.0');
 expect(item?.meta).toContain('Aquifer');
});

it('keeps actual Mark 6 doctrinal background out of History without generated facts', async () => {
 const { localEvidence } = await import('../server/study/evidence');
 const local = await localEvidence({ book: 40, chapter: 6, firstVerse: 14, lastVerse: 29 });
 const items = itemsFrom(result({ ...local }));
 expect(items.some(item => item.category === 'academic' && item.text.includes('repent and have faith'))).toBe(true);
 expect(items.filter(item => item.category === 'history')).toEqual([]);
});

it('keeps a validated Scripture-only guide answer outside History', async () => {
 const { validateGenerated } = await import('../server/study/answer');
 const scripture: StudySource = { ...source, id: 'bible:web', kind: 'scripture', scope: 'direct' };
 const generated = validateGenerated({ guide: [{ id: 'contextualize', answer: 'This narrative teaches obedience to God.', sourceIds: ['bible:web'] }] }, [scripture]);
 const items = itemsFrom(result({ sources: [scripture], ...generated }));
 expect(items.find(item => item.text === 'This narrative teaches obedience to God.')?.category).toBe('academic');
 expect(items.filter(item => item.category === 'history')).toEqual([]);
});

it('retains thumbnail metadata for curated and discovered videos', () => {
 const videos: StudyResult['videos'] = [true, false].map((reviewed, i) => ({
  id: i ? 'WTL3mrkoeEI' : 'jQm8ElP8Kj0', title: `Teaching ${i}`, channel:'Bible teaching',
  url:`https://www.youtube.com/watch?v=${i ? 'WTL3mrkoeEI' : 'jQm8ElP8Kj0'}`,
  scope:'context', verification:'video link only', durationSeconds:165, reviewed
 }));
 const items=itemsFrom(result({sources:[],videos}));
 expect(items.map(item=>item.video)).toEqual(videos);
 expect(items.map(item=>item.kind)).toEqual(['Curated','YouTube search']);
 expect(items.every(item=>item.meta==='Bible teaching · 2:45 · Chapter context')).toBe(true);
});
