import type { StudyGuideStep, StudySource, StudyStepId } from '#lib/read/study.js';
import { BOOKS, bookSlug } from '#lib/read/books.js';

export const GUIDE_QUESTIONS: Array<{ id: StudyStepId; question: string }> = [
	{ id: 'observe', question: 'What details, repetitions, or contrasts does the text contain?' },
	{ id: 'contextualize', question: 'What did this mean in its literary and historical setting?' },
	{ id: 'trace', question: 'Where does Scripture repeat or develop this pattern?' },
	{ id: 'christ', question: 'How does this connect to Christ and the gospel?' },
	{ id: 'apply', question: 'What response of faith, repentance, or hope follows?' }
];

const NT_SOURCE_PREFIXES = BOOKS.filter(book => book.newTestament).map(book => `bible:web:${bookSlug(book)}:`);

export interface GeneratedGuideStep {
	id?: string;
	title?: string;
	answer?: string;
	sourceIds?: string[];
	connection?: string;
}

/** Keep the fixed reading path even when no model answer or evidence is available. */
export function buildGuide(generated: GeneratedGuideStep[], sources: StudySource[]): StudyGuideStep[] {
	const byId = new Map(sources.map((source) => [source.id, source]));
	const steps = new Map(generated.map((step) => [step.id, step]));
	return GUIDE_QUESTIONS.map(({ id, question }) => {
		const raw = steps.get(id);
		const sourceIds = [...new Set((raw?.sourceIds ?? []).filter((key) => byId.has(key)))];
		const answer = typeof raw?.answer === 'string' ? raw.answer.trim().slice(0, 850) : '';
		const title = typeof raw?.title === 'string' ? raw.title.trim().slice(0, 110) : '';
		const christSupported = id !== 'christ' || sourceIds.some((key) =>
			byId.get(key)?.kind === 'scripture' && NT_SOURCE_PREFIXES.some(prefix => key.startsWith(prefix)));
		const traceSupported = id !== 'trace' || sourceIds.some(key =>
			byId.get(key)?.kind === 'scripture' && byId.get(key)?.scope === 'related');
		if (!answer || !sourceIds.length || !christSupported || !traceSupported) return { id, question, answer: null, sourceIds: [] };
		const connection = id === 'christ' && ['explicit', 'allusion', 'theme'].includes(raw?.connection ?? '')
			? raw?.connection as StudyGuideStep['connection'] : undefined;
		return { id, question, answer, sourceIds, ...(title ? { title } : {}), ...(connection ? { connection } : {}) };
	});
}
