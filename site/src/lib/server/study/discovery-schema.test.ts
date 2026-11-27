import { expect, it } from 'vitest';
import { parseDiscoveries, parseLesson, wordCount } from './discovery-schema';

const unit = (id: string, words = 10) => ({ id, text: Array(words).fill('evidence').join(' '), sourceIds: ['s1'], basis: 'text', tradition: null });
const discovery = () => ({ id: 'd1', category: 'academic', title: unit('title', 5), explanation: [unit('explanation', 75)], payoff: unit('payoff', 15) });
const lesson = () => ({
 discoveryId: 'd1',
 sections: ['discovery', 'passage', 'evidence', 'disagreement', 'payoff'].map(kind => ({ kind, units: [unit(kind, 190)] })),
 exercise: { passages: [{ book: 18, chapter: 82, firstVerse: 1, lastVerse: 8 }, { book: 17, chapter: 1, firstVerse: 6, lastVerse: 12 }], questions: ['Who speaks?', 'What changes?', 'What remains uncertain?'] },
 visual: { kind: 'relationships', nodes: [{ id: 'a', label: unit('a'), x: null, y: null, xLow: null, xHigh: null, yLow: null, yHigh: null }, { id: 'b', label: unit('b'), x: null, y: null, xLow: null, xHigh: null, yLow: null, yHigh: null }], edges: [{ from: 'a', to: 'b', label: unit('edge') }], xLabel: null, yLabel: null, xUnit: null, yUnit: null, explanation: unit('visual'), limitations: 'The diagram does not establish chronology.' }, images: []
});
const sources = new Set(['s1']);
it('accepts a supported concise discovery without requiring three findings', () => {
 expect(parseDiscoveries([discovery()], sources)).toHaveLength(1);
 expect(wordCount('A detail changes the reading.')).toBe(5);
});
it('rejects unknown citations, duplicate IDs, extra fields and padding quotas', () => {
 const unknown = discovery(); unknown.payoff.sourceIds = ['missing'];
 expect(parseDiscoveries([unknown], sources)).toEqual([]);
 const duplicate = discovery(); duplicate.payoff.id = 'title';
 expect(parseDiscoveries([duplicate], sources)).toEqual([]);
 expect(parseDiscoveries([{ ...discovery(), html: '<script />' }], sources)).toEqual([]);
 expect(parseDiscoveries(Array(6).fill(discovery()), sources)).toEqual([]);
 const short = discovery(); short.explanation[0].text = 'Too short';
 expect(parseDiscoveries([short], sources)).toEqual([]);
});
it('accepts complete teaching prose with an exercise and a sourced visual', () => {
 expect(parseLesson(lesson(), sources)?.discoveryId).toBe('d1');
});
it('rejects missing sections, invented citations and broken graph relationships', () => {
 const missing = lesson(); missing.sections.pop();
 expect(parseLesson(missing, sources)).toBeNull();
 const graph = lesson(); graph.visual.edges[0].to = 'absent';
 expect(parseLesson(graph, sources)).toBeNull();
 const unknown = lesson(); unknown.visual.explanation.sourceIds = ['forum'];
 expect(parseLesson(unknown, sources)).toBeNull();
 const short = lesson(); short.sections[0].units[0].text = 'short';
 expect(parseLesson(short, sources)).toBeNull();
});
it('requires real numerical coordinates and units for quantitative visuals', () => {
 const chart = lesson(); chart.visual.kind = 'quantitative';
 expect(parseLesson(chart, sources)).toBeNull();
});
