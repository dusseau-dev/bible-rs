/** The web study panel's public request and response contract. */
export interface StudyPassage {
	book: number;
	chapter: number;
	firstVerse: number;
	lastVerse: number;
}

export type StudyLayer = 'text' | 'history' | 'language' | 'interpretation' | 'uncertainty';
export type Tradition = 'protestant' | 'catholic' | 'orthodox' | 'jewish' | null;
export type EvidenceScope = 'direct' | 'context' | 'related';

export interface StudySource {
	id: string;
	title: string;
	author: string;
	kind: 'scripture' | 'study_note' | 'language_data' | 'academic' | 'commentary';
	tradition: Tradition;
	scope: EvidenceScope;
	url: string;
	location: string;
	license: string;
	excerpt: string;
}

export interface StudyTerm {
	verse: number;
	original: string;
	transliteration: string;
	gloss: string;
	lemma: string;
	sourceId: string;
}

export interface StudyClaim {
	layer: StudyLayer;
	text: string;
	sourceIds: string[];
	tradition: Tradition;
}

export interface StudyVideo {
	id: string;
	title: string;
	channel: string;
	url: string;
	scope: EvidenceScope;
	verification: 'video link only';
}

export interface StudyResult {
	reference: string;
	passageText: string;
	contextText: string;
	sources: StudySource[];
	terms: StudyTerm[];
	claims: StudyClaim[];
	videos: StudyVideo[];
	answer: { text: string; sourceIds: string[] } | null;
	message?: string;
}

export interface StudyRequest {
	passage: StudyPassage;
	mode: 'open' | 'ask';
	question?: string;
	style: 'standard' | 'simple';
	openaiKey?: string;
}
