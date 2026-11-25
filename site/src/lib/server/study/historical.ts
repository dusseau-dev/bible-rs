import type { StudyPassage, StudySource } from '#lib/read/study.js';

export { HISTORY_TOPICS, historyTopicsIn } from '#lib/read/history-topics.js';

interface RecordLink {
	id: string;
	title: string;
	author: string;
	url: string;
	location: string;
	excerpt: string;
	wholeBook?: number;
	passages: Array<{ book: number; chapter: number; firstVerse: number; lastVerse: number }>;
}

/** Curated museum records. Contextual evidence is never treated as proof of a narrated miracle. */
const RECORDS: RecordLink[] = [
	{
		id: 'met:cyrus:cylinder',
		title: 'The Cyrus Cylinder and Persian restoration policy',
		author: 'The Metropolitan Museum of Art',
		url: 'https://www.metmuseum.org/exhibitions/listings/2013/cyrus-cylinder',
		location: 'Babylon · after 539 BCE',
		excerpt: 'The cylinder records Cyrus’s conquest of Babylon and restoration of shrines and displaced peoples. It provides context for Persian policy, but does not name Judah or reproduce the decree described in Ezra.',
		passages: [
			{ book: 13, chapter: 36, firstVerse: 22, lastVerse: 23 },
			{ book: 14, chapter: 1, firstVerse: 1, lastVerse: 4 },
			{ book: 22, chapter: 45, firstVerse: 1, lastVerse: 13 }
		]
	},
	{
		id: 'imj:sennacherib:prism',
		title: 'The Sennacherib Prism',
		author: 'The Israel Museum, Jerusalem',
		url: 'https://imj.org.il/en/exhibitions/special-display-assyrian-campaign-judah-told-sennacherib-prism',
		location: 'Nineveh · inscription dated 691 BCE; campaign in 701 BCE',
		excerpt: 'This Akkadian royal inscription recounts Sennacherib’s campaign in Judah and names Hezekiah and Jerusalem. It does not explicitly describe an Assyrian siege of Jerusalem or settle the biblical account of its outcome.',
		passages: [
			{ book: 11, chapter: 18, firstVerse: 13, lastVerse: 37 },
			{ book: 11, chapter: 19, firstVerse: 1, lastVerse: 37 },
			{ book: 13, chapter: 32, firstVerse: 1, lastVerse: 23 },
			{ book: 22, chapter: 36, firstVerse: 1, lastVerse: 22 },
			{ book: 22, chapter: 37, firstVerse: 1, lastVerse: 38 }
		]
	},
	{
		id: 'met:sennacherib:701',
		title: 'Sennacherib’s annals and the Lachish reliefs',
		author: 'The Metropolitan Museum of Art · Ira Spar',
		url: 'https://www.metmuseum.org/exhibitions/listings/2014/assyria-to-iberia/blog/posts/sennacherib-and-jerusalem',
		location: 'Assyria and Judah · 701 BCE',
		excerpt: 'Assyrian annals and palace reliefs document Sennacherib’s campaign in Judah and the capture of Lachish. The records give an independent account of the campaign, while the accounts of Jerusalem’s outcome differ.',
		passages: [
			{ book: 11, chapter: 18, firstVerse: 13, lastVerse: 37 },
			{ book: 11, chapter: 19, firstVerse: 1, lastVerse: 37 },
			{ book: 13, chapter: 32, firstVerse: 1, lastVerse: 23 },
			{ book: 22, chapter: 36, firstVerse: 1, lastVerse: 22 },
			{ book: 22, chapter: 37, firstVerse: 1, lastVerse: 38 }
		]
	},
	{
		id: 'imj:isaiah:scroll',
		title: 'The Great Isaiah Scroll',
		author: 'The Israel Museum, Jerusalem',
		url: 'https://www.imj.org.il/en/exhibitions/voice-desert',
		location: 'Dead Sea Scrolls · manuscript evidence',
		excerpt: 'The Great Isaiah Scroll is an ancient manuscript witness to the book of Isaiah. It documents the text’s transmission, not the historical occurrence of every event described in the book.',
		wholeBook: 22,
		passages: []
	},
	{
		id: 'imj:temple:trumpeting',
		title: 'Temple Mount “place of trumpeting” inscription',
		author: 'The Israel Museum, Jerusalem',
		url: 'https://www.imj.org.il/en/node/6580950',
		location: 'Jerusalem · Herodian period, first century BCE',
		excerpt: 'This inscribed stone from the Temple Mount’s southwestern corner documents part of the Second Temple complex. It provides architectural context, not evidence for a specific speech by Jesus.',
		passages: [
			{ book: 39, chapter: 24, firstVerse: 1, lastVerse: 2 },
			{ book: 40, chapter: 13, firstVerse: 1, lastVerse: 2 },
			{ book: 41, chapter: 21, firstVerse: 5, lastVerse: 6 }
		]
	},
	{
		id: 'imj:pilate:inscription',
		title: 'Inscription bearing the name of Pontius Pilate',
		author: 'The Israel Museum, Jerusalem',
		url: 'https://www.imj.org.il/en/exhibitions/cradle-christianity',
		location: 'Roman Judea · first century CE',
		excerpt: 'An inscription bearing Pontius Pilate’s name is physical evidence for the Roman official named in the Gospels. It does not document the events of Jesus’ trial.',
		passages: [
			{ book: 39, chapter: 27, firstVerse: 1, lastVerse: 26 },
			{ book: 40, chapter: 15, firstVerse: 1, lastVerse: 15 },
			{ book: 41, chapter: 3, firstVerse: 1, lastVerse: 1 },
			{ book: 41, chapter: 23, firstVerse: 1, lastVerse: 25 },
			{ book: 42, chapter: 18, firstVerse: 28, lastVerse: 40 },
			{ book: 42, chapter: 19, firstVerse: 1, lastVerse: 16 }
		]
	}
];

export function historicalRecordSources(passage: StudyPassage): StudySource[] {
	return RECORDS.filter((record) => record.wholeBook === passage.book || record.passages.some((ref) =>
		ref.book === passage.book && ref.chapter === passage.chapter &&
		ref.firstVerse <= passage.lastVerse && ref.lastVerse >= passage.firstVerse
	)).map((record) => ({
		id: record.id, title: record.title, author: record.author, url: record.url,
		location: record.location, excerpt: record.excerpt, kind: 'historical_record' as const,
		tradition: null, scope: 'context' as const, license: 'Link only'
	}));
}
