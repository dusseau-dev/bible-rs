import { BOOKS, bookSlug } from '#lib/read/books.js';
import { chapterVerses, core } from '#lib/read/core.js';
import type { StudyPassage, StudySource, StudyTerm, StudyVideo, Tradition } from '#lib/read/study.js';
import { historicalRecordSources, historyTopicsIn } from './historical.js';
import { durationSeconds } from './youtube.js';

const STEP_REV = '5de0a47f35f0fc13dfe1430d104e5db8a4285f9c';
const AQUIFER_REV = '35183d839b73958deca66fe4060d4dc7d4dc23de';
const files = import.meta.glob('./data/*.json', { import: 'default' });

interface Note {
	id: string;
	title: string;
	from: [number, number];
	to: [number, number];
	text: string;
}
interface ChapterData {
	notes: Note[];
	terms: Record<string, [string, string, string, string][]>;
}

export function passageFrom(value: unknown): StudyPassage | null {
	if (!value || typeof value !== 'object') return null;
	const p = value as Record<string, unknown>;
	const { book, chapter, firstVerse, lastVerse } = p;
	if (![book, chapter, firstVerse, lastVerse].every((n) => Number.isSafeInteger(n))) return null;
	if (
		(book as number) < 0 ||
		(book as number) >= BOOKS.length ||
		(chapter as number) < 1 ||
		(chapter as number) > BOOKS[book as number].chapters ||
		(firstVerse as number) < 1 ||
		(lastVerse as number) < (firstVerse as number) ||
		(lastVerse as number) - (firstVerse as number) >= 30
	)
		return null;
	return { book, chapter, firstVerse, lastVerse } as StudyPassage;
}

export const passageLabel = (p: StudyPassage) =>
	`${BOOKS[p.book].name === 'Psalms' ? 'Psalm' : BOOKS[p.book].name} ${p.chapter}:${p.firstVerse}${p.lastVerse > p.firstVerse ? `–${p.lastVerse}` : ''}`;

const point = ([chapter, verse]: [number, number]) => chapter * 1000 + verse;

async function bookData(book: number): Promise<Record<string, ChapterData>> {
	const loader = files[`./data/${String(book).padStart(2, '0')}.json`];
	return loader ? ((await loader()) as Record<string, ChapterData>) : {};
}

/**
 * Study notes from earlier in the book that give historical background, chosen so that
 * together they touch as many history topics as possible. Only notes ending before `start`.
 */
export function bookContextNotes(data: Record<string, Pick<ChapterData, 'notes'>>, start: number, limit = 6): Note[] {
	// Notes spanning chapters are stored under each chapter, so dedupe by id.
	const unique = new Map(Object.values(data).flatMap((chapter) => chapter.notes).map((note) => [note.id, note]));
	const candidates = [...unique.values()]
		.filter((note) => point(note.to) < start)
		.map((note) => ({ note, topics: historyTopicsIn(note.text) }))
		.filter((item) => item.topics.length);
	const covered = new Set<number>();
	const gain = (item: (typeof candidates)[number]) => item.topics.filter((t) => !covered.has(t)).length;
	const picked: Note[] = [];
	while (picked.length < limit && candidates.length) {
		let best = 0;
		for (let i = 1; i < candidates.length; i++) {
			const diff = gain(candidates[i]) - gain(candidates[best]);
			if (diff > 0 || (diff === 0 && point(candidates[i].note.to) > point(candidates[best].note.to))) best = i;
		}
		const [chosen] = candidates.splice(best, 1);
		chosen.topics.forEach((t) => covered.add(t));
		picked.push(chosen.note);
	}
	return picked;
}

export async function localEvidence(p: StudyPassage): Promise<{
	passageText: string;
	contextText: string;
	sources: StudySource[];
	terms: StudyTerm[];
}> {
	const c = await core();
	await c.load('web');
	const index = BOOKS[p.book].firstChapter + p.chapter - 1;
	if (p.lastVerse > chapterVerses(index)) throw new Error('The passage has no such verse');
	const verses = c.verses('web', index);
	const line = (number: number) => {
		const v = verses.find((item) => item.number === number);
		return v ? `${number} ${v.runs.map((run) => run.text).join('')}` : '';
	};
	const selected = Array.from({ length: p.lastVerse - p.firstVerse + 1 }, (_, i) => p.firstVerse + i);
	const passageText = selected.map(line).filter(Boolean).join('\n');
	const blocks = c.chapter('web', index, { versePerLine: false, headings: true, verseNumbers: true }).blocks;
	const touching = blocks.filter((block) => {
		const numbers = block.runs.map((run) => run.verse).filter((n) => n > 0);
		return numbers.some((n) => n >= p.firstVerse && n <= p.lastVerse);
	});
	const around = [...new Set(touching.flatMap((block) => block.runs.map((run) => run.verse).filter((n) => n > 0)))].sort(
		(a, b) => a - b
	);
	const startVerse = Math.max(1, p.firstVerse - 3);
	const endVerse = Math.min(verses.length, p.lastVerse + 3);
	const context = around.length > 36
		? Array.from({ length: endVerse - startVerse + 1 }, (_, i) => startVerse + i)
		: around;
	const contextText = context.map(line).filter(Boolean).join('\n') || passageText;
	const bibleSource: StudySource = {
		id: 'bible:web',
		title: 'World English Bible',
		author: 'World English Bible',
		kind: 'scripture',
		tradition: null,
		scope: 'direct',
		url: `/read/web/${bookSlug(BOOKS[p.book])}/${p.chapter}`,
		location: passageLabel(p),
		license: 'Public domain',
		excerpt: contextText.slice(0, 5000)
	};

	const book = await bookData(p.book);
	const data = book[String(p.chapter)] ?? { notes: [], terms: {} };
	const start = p.chapter * 1000 + p.firstVerse;
	const end = p.chapter * 1000 + p.lastVerse;
	const notes = data.notes
		.filter((n) => point(n.from) <= end && point(n.to) >= start)
		.map((n) => ({
			n,
			direct: point(n.from) >= start && point(n.to) <= end,
			width: point(n.to) - point(n.from)
		}))
		.sort((a, b) => Number(b.direct) - Number(a.direct) || a.width - b.width)
		.slice(0, 8);
	const sources: StudySource[] = [bibleSource];
	sources.push(...historicalRecordSources(p));
	if (p.book === 0 && p.chapter === 3 && p.firstVerse <= 21 && p.lastVerse >= 7) {
		const romansIndex = BOOKS[44].firstChapter + 4;
		const romans = c.verses('web', romansIndex);
		const excerpt = [12, 18, 19].map((number) => {
			const verse = romans.find((item) => item.number === number);
			return verse ? `${number} ${verse.runs.map((run) => run.text).join('')}` : '';
		}).filter(Boolean).join('\n');
		sources.push({
			id: 'bible:web:romans:5', title: 'Romans 5:12, 18–19 · World English Bible', author: 'World English Bible',
			kind: 'scripture', tradition: null, scope: 'related', url: '/read/web/romans/5',
			location: 'Romans 5:12, 18–19', license: 'Public domain', excerpt
		});
	}
	const studyNote = (n: Note, scope: StudySource['scope'], length: number): StudySource => ({
		id: `aosn:${n.id}`,
		title: n.title,
		author: 'Aquifer Open Study Notes · Mission Mutual',
		kind: 'study_note',
		tradition: null,
		scope,
		url: `https://github.com/BibleAquifer/AquiferOpenStudyNotes/blob/${AQUIFER_REV}/eng/json/${String(p.book + 1).padStart(2, '0')}.content.json`,
		location: n.title,
		license: 'CC BY-SA 4.0',
		excerpt: n.text.slice(0, length)
	});
	for (const { n, direct } of notes) sources.push(studyNote(n, direct ? 'direct' : 'context', 1400));
	// Background from earlier in the book, up to where the reader is, for the history notes.
	const shown = new Set(notes.map(({ n }) => n.id));
	for (const n of bookContextNotes(book, start)) if (!shown.has(n.id)) sources.push(studyNote(n, 'related', 700));

	const terms: StudyTerm[] = [];
	for (const verse of selected) {
		const words = data.terms[String(verse)] ?? [];
		if (!words.length) continue;
		const sourceId = `step:${p.book}:${p.chapter}:${verse}`;
		const sourceTerms = words.map(([original, transliteration, gloss, lemma]) => ({
			verse,
			original,
			transliteration,
			gloss,
			lemma,
			sourceId
		}));
		terms.push(...sourceTerms);
		sources.push({
			id: sourceId,
			title: 'STEPBible tagged Hebrew/Greek text',
			author: 'Tyndale House Cambridge / STEPBible',
			kind: 'language_data',
			tradition: null,
			scope: 'direct',
			url: `https://github.com/STEPBible/STEPBible-Data/tree/${STEP_REV}/Translators%20Amalgamated%20OT%2BNT`,
			location: `${BOOKS[p.book].name} ${p.chapter}:${verse}`,
			license: 'CC BY 4.0',
			excerpt: sourceTerms.map((term) => `${term.original} (${term.transliteration}): ${term.gloss}; ${term.lemma}`).join(' · ').slice(0, 1800)
		});
	}
	for (const entry of HISTORIC_COMMENTARY) {
		if (entry.book !== p.book || entry.chapter !== p.chapter || entry.firstVerse > p.lastVerse || entry.lastVerse < p.firstVerse) continue;
		sources.push({
			id: entry.id, title: entry.title, author: 'Matthew Henry', kind: 'commentary',
			tradition: 'protestant', scope: 'direct', url: entry.url,
			location: `${BOOKS[p.book].name} ${p.chapter}:${entry.firstVerse}–${entry.lastVerse}`,
			license: 'Public domain original work', excerpt: entry.excerpt
		});
	}
	for (const entry of CURATED_LINKS) {
		if (entry.book !== p.book || entry.chapter !== p.chapter || entry.firstVerse > p.lastVerse || entry.lastVerse < p.firstVerse) continue;
		sources.push({
			id: entry.id, title: entry.title, author: entry.author, kind: 'commentary',
			tradition: entry.tradition, scope: 'direct', url: entry.url,
			location: `${BOOKS[p.book].name} ${p.chapter}:${entry.firstVerse}–${entry.lastVerse}`,
			license: 'Link only', excerpt: entry.excerpt
		});
	}
	return { passageText, contextText, sources, terms };
}

/** Reviewed excerpts from Matthew Henry's public-domain commentary, linked to their CCEL editions. */
const HISTORIC_COMMENTARY = [
	{
		id: 'henry:john:3:16', book: 42, chapter: 3, firstVerse: 16, lastVerse: 17,
		title: 'Commentary on John 3',
		url: 'https://ccel.org/ccel/henry/mhc5/mhc5.John.iv.html',
		excerpt: 'Henry describes God’s love in giving his Son for the world, the general offer to whoever believes, and the promise of life rather than perishing.'
	},
	{
		id: 'henry:romans:8:1', book: 44, chapter: 8, firstVerse: 1, lastVerse: 4,
		title: 'Commentary on Romans 8',
		url: 'https://ccel.org/ccel/henry/mhc6/mhc6.Rom.ix.html',
		excerpt: 'Henry reads “no condemnation” as a privilege of believers united to Christ. He distinguishes freedom from condemnation from an absence of sin, accusation, or affliction.'
	}
];

/** Reviewed passage links. Descriptions are newly written; linked sites are not ingested. */
const CURATED_LINKS: Array<{
	id: string; book: number; chapter: number; firstVerse: number; lastVerse: number;
	title: string; author: string; tradition: Exclude<Tradition, null>; url: string; excerpt: string;
}> = [
	{
		id: 'usccb:john:3', book: 42, chapter: 3, firstVerse: 16, lastVerse: 21,
		title: 'John 3 footnotes', author: 'United States Conference of Catholic Bishops', tradition: 'catholic',
		url: 'https://bible.usccb.org/bible/john/3',
		excerpt: 'The USCCB notes treat verses 16–21 as the evangelist’s reflection and explain “gave” in relation to both the incarnation and the crucifixion.'
	},
	{
		id: 'rashi:genesis:1:1', book: 0, chapter: 1, firstVerse: 1, lastVerse: 1,
		title: 'Rashi on Genesis 1:1', author: 'Rashi · via Sefaria', tradition: 'jewish',
		url: 'https://www.sefaria.org/Rashi_on_Genesis.1.1.1?lang=en',
		excerpt: 'Rashi asks why the Torah begins with creation rather than the first commandment to Israel, and connects the opening to God’s ownership of the earth.'
	}
];

/** Only reviewed, passage-specific links appear here. They are not transcript evidence. */
const VIDEOS: Array<StudyVideo & { book: number; chapter: number; firstVerse: number; lastVerse: number }> = [
	{
		id: 'jQm8ElP8Kj0', title: 'Bible Thought Genesis 3:6–7', channel: 'The Red Barn Youth Center',
		url: 'https://www.youtube.com/watch?v=jQm8ElP8Kj0', scope: 'direct', verification: 'video link only',
		durationSeconds: 165, format: 'short', reviewed: true,
		book: 0, chapter: 3, firstVerse: 6, lastVerse: 7
	},
	{
		id: 'WTL3mrkoeEI', title: 'Genesis 3: God Covers Sinners with Love', channel: 'Northland Church',
		url: 'https://www.youtube.com/watch?v=WTL3mrkoeEI', scope: 'context', verification: 'video link only',
		durationSeconds: 2859, format: 'full', reviewed: true,
		book: 0, chapter: 3, firstVerse: 1, lastVerse: 24
	},
	{
		id: 'j3zujMWyKPI', title: 'When the Spirit Frees Us to Love', channel: 'Desiring God',
		url: 'https://www.youtube.com/watch?v=j3zujMWyKPI', scope: 'direct', verification: 'video link only', reviewed: true,
		book: 44, chapter: 8, firstVerse: 1, lastVerse: 4
	},
	{
		id: 'i-EJ-BtdcCk', title: 'Trust Christ, Not Law-Keeping', channel: 'Desiring God',
		url: 'https://www.youtube.com/watch?v=i-EJ-BtdcCk', scope: 'direct', verification: 'video link only', reviewed: true,
		book: 44, chapter: 8, firstVerse: 1, lastVerse: 4
	}
];

export function passageVideos(p: StudyPassage): StudyVideo[] {
	return VIDEOS.filter((v) => v.book === p.book && v.chapter === p.chapter && v.firstVerse <= p.lastVerse && v.lastVerse >= p.firstVerse)
		.map(({ id, title, channel, url, scope, verification, reviewed, durationSeconds, format }) =>
			({ id, title, channel, url, scope, verification, reviewed, durationSeconds, format }));
}

/** Refresh the reviewed links' public metadata when the site's YouTube key is configured. */
export async function verifiedPassageVideos(p: StudyPassage, key: string | undefined): Promise<StudyVideo[]> {
	const videos = passageVideos(p);
	if (!key || !videos.length) return videos;
	try {
		const url = new URL('https://www.googleapis.com/youtube/v3/videos');
		url.searchParams.set('part', 'snippet,contentDetails,status');
		url.searchParams.set('id', videos.map((video) => video.id).join(','));
		url.searchParams.set('key', key);
		const response = await fetch(url, { signal: AbortSignal.timeout(6_000) });
		if (!response.ok) return videos;
		const body = await response.json() as { items?: Array<{ id: string; snippet?: { title?: string; channelTitle?: string }; contentDetails?: { duration?: string }; status?: { privacyStatus?: string } }> };
		const found = new Map((body.items ?? []).map((item) => [item.id, item]));
		return videos.flatMap((video) => {
			const item = found.get(video.id);
			if (!item || item.status?.privacyStatus !== 'public') return [];
			const duration = durationSeconds(item.contentDetails?.duration);
			return [{ ...video, title: item.snippet?.title || video.title, channel: item.snippet?.channelTitle || video.channel,
				...(duration ? { durationSeconds: duration, format: duration < 240 ? 'short' as const : 'full' as const } : {}) }];
		});
	} catch {
		return videos;
	}
}

export function traditionForDomain(url: string): Tradition {
	const host = new URL(url).hostname;
	if (host === 'bible.usccb.org') return 'catholic';
	if (host === 'www.oca.org' || host === 'oca.org') return 'orthodox';
	if (host === 'www.sefaria.org' || host === 'sefaria.org') return 'jewish';
	return null;
}
