import type { StudyGuideStep, StudySource, StudyStepId } from '#lib/read/study.js';

export const GUIDE_QUESTIONS: Array<{ id: StudyStepId; question: string }> = [
	{ id: 'observe', question: 'What details, repetitions, or contrasts does the text contain?' },
	{ id: 'contextualize', question: 'What did this mean in its literary and historical setting?' },
	{ id: 'trace', question: 'Where does Scripture repeat or develop this pattern?' },
	{ id: 'christ', question: 'How does this connect to Christ and the gospel?' },
	{ id: 'apply', question: 'What response of faith, repentance, or hope follows?' }
];

const REVIEWED_NT_CROSS_REFERENCES = new Set(['bible:web:romans:5']);

export interface GeneratedGuideStep {
	id?: string;
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
		const answer = typeof raw?.answer === 'string' ? raw.answer.trim().slice(0, 450) : '';
		const christSupported = id !== 'christ' || sourceIds.some((key) =>
			byId.get(key)?.kind === 'scripture' && REVIEWED_NT_CROSS_REFERENCES.has(key));
		if (!answer || !sourceIds.length || !christSupported) return { id, question, answer: null, sourceIds: [] };
		const connection = id === 'christ' && ['explicit', 'allusion', 'theme'].includes(raw?.connection ?? '')
			? raw?.connection as StudyGuideStep['connection'] : undefined;
		return { id, question, answer, sourceIds, ...(connection ? { connection } : {}) };
	});
}
