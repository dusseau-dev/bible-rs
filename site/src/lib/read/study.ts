/** The web study panel's public request and response contract. */
export interface StudyPassage {
	book: number;
	chapter: number;
	firstVerse: number;
	lastVerse: number;
}

export type StudyLayer = 'text' | 'history' | 'language' | 'interpretation' | 'uncertainty';
export type StudyStepId = 'observe' | 'contextualize' | 'trace' | 'christ' | 'apply';
export type Tradition = 'protestant' | 'catholic' | 'orthodox' | 'jewish' | null;
export type EvidenceScope = 'direct' | 'context' | 'related';

export interface StudySource {
	id: string;
	title: string;
	author: string;
	kind: 'scripture' | 'study_note' | 'language_data' | 'academic' | 'commentary' | 'historical_record';
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
	durationSeconds?: number;
	format?: 'short' | 'full';
	reviewed?: boolean;
}

export interface StudyPaper {
	id: string;
	title: string;
	authors: string;
	venue: string;
	year: number | null;
	type: string;
	doi: string | null;
	url: string;
	scope: 'direct' | 'context';
	openAccess: boolean;
}

export interface StudyGuideStep {
	id: StudyStepId;
	question: string;
	answer: string | null;
	sourceIds: string[];
	connection?: 'explicit' | 'allusion' | 'theme';
}

export interface StudyTestimonial {
	id: string;
	title: string;
	author: string;
	url: string;
	scope: 'direct' | 'related';
	theme?: string;
}

export interface StudyResult {
	/** Additive for older clients; completed with no results differs from not searched. */
	discovery?: Record<DiscoveryKind, DiscoveryStatus>;
	reference: string;
	passageText: string;
	contextText: string;
	sources: StudySource[];
	terms: StudyTerm[];
	claims: StudyClaim[];
	videos: StudyVideo[];
	papers: StudyPaper[];
	guide: StudyGuideStep[];
	testimonials: StudyTestimonial[];
	answer: { text: string; sourceIds: string[] } | null;
	message?: string;
}

export type DiscoveryKind = 'sources' | 'testimonials' | 'papers' | 'videos';
export type DiscoveryStatus = 'complete' | 'disabled' | 'rate_limited' | 'failed' | 'partial';
export interface DiscoveryResult<T> { items: T[]; status: DiscoveryStatus }

export interface StudyRequest {
	passage: StudyPassage;
	mode: 'open' | 'ask' | 'explain';
	question?: string;
	style: 'standard' | 'simple';
	aiKey?: string;
	/** Kept for clients using the original request shape. */
	openaiKey?: string;
}
