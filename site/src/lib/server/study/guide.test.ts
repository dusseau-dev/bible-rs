import { describe, expect, it } from 'vitest';
import type { StudySource } from '#lib/read/study.js';
import { buildGuide } from './guide.js';

const source = (id: string, kind: StudySource['kind']): StudySource => ({
	id, kind, title: id, author: 'Test', tradition: null, scope: 'direct', url: '/test', location: '', license: '', excerpt: ''
});

describe('buildGuide', () => {
	it('always returns ordered prompts without inventing answers', () => {
		const steps = buildGuide([], []);
		expect(steps.map((step) => step.id)).toEqual(['observe', 'contextualize', 'trace', 'christ', 'apply']);
		expect(steps.every((step) => step.answer === null)).toBe(true);
	});
	it('drops unknown citations and unsupported Christ claims', () => {
		const steps = buildGuide([
			{ id: 'observe', answer: 'Fig leaves are specified.', sourceIds: ['bible:web', 'made-up'] },
			{ id: 'christ', answer: 'This points to Jesus.', sourceIds: ['bible:web'], connection: 'explicit' }
		], [source('bible:web', 'scripture')]);
		expect(steps[0].sourceIds).toEqual(['bible:web']);
		expect(steps[3].answer).toBeNull();
	});
	it('accepts a Christ answer only with a reviewed New Testament cross-reference', () => {
		const step = buildGuide([{ id: 'christ', answer: 'Adam and Christ are compared.', sourceIds: ['bible:web:romans:5'], connection: 'explicit' }], [source('bible:web:romans:5', 'scripture')])[3];
		expect(step.answer).toBe('Adam and Christ are compared.');
		expect(step.connection).toBe('explicit');
	});
	it('requires another Scripture passage for an echo and keeps its hook', () => {
		const steps = buildGuide([
			{ id: 'trace', title: 'Why does John reuse the beginning?', answer: 'John develops the creation language.', sourceIds: ['bible:web:john:1:1-3'] },
			{ id: 'christ', title: 'Who is the Word in creation?', answer: 'John places the Word at the beginning.', sourceIds: ['bible:web:john:1:1-3'], connection: 'allusion' }
		], [{ ...source('bible:web:john:1:1-3', 'scripture'), scope: 'related' }]);
		expect(steps[2].title).toBe('Why does John reuse the beginning?');
		expect(steps[3].answer).not.toBeNull();
		expect(buildGuide([{ id:'trace', answer:'God brings order out of chaos.', sourceIds:['note'] }], [source('note', 'study_note')])[2].answer).toBeNull();
	});
});
