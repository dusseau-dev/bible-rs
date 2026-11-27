import type { ResearchImage } from '#lib/read/discoveries.js';
import type { StudyPassage, StudySource } from '#lib/read/study.js';

// Verified 2026-11-27 against the object API (isPublicDomain=true), collection record
// and https://www.metmuseum.org/hubs/open-access. The object date is NOT a campaign date.
const source: StudySource = {
 id: 'met:321775', title: 'Cuneiform cylinder: inscription of Sennacherib describing his third campaign',
 author: 'The Metropolitan Museum of Art', kind: 'historical_record', tradition: null, scope: 'related',
 url: 'https://www.metmuseum.org/art/collection/search/321775', location: 'Object 86.11.197', license: 'CC0 1.0',
 excerpt: 'The Met catalogues object 86.11.197 as a clay cuneiform cylinder with an inscription of Sennacherib describing his third campaign. The museum dates the object approximately 704–681 BCE and identifies its geography as Mesopotamia, Nineveh (?). Credit: Purchase, 1886. The collection record marks the image Public Domain.'
};
const cylinder: ResearchImage = {
 id: 'met-321775', sourceId: source.id, src: 'https://images.metmuseum.org/CRDImages/an/web-large/ME86_11_197.jpg',
 sourceUrl: source.url, credit: 'The Metropolitan Museum of Art, Purchase, 1886, 86.11.197',
 license: 'CC0 1.0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/', date: 'ca. 704–681 BCE',
 provenance: 'The museum lists Nineveh (?) as the possible location; Purchase, 1886.', depiction: 'artifact',
 alt: 'Small clay fragment bearing rows of cuneiform signs',
 caption: { id: 'image-met-321775', text: 'A fragment of Sennacherib’s campaign inscription. The museum’s approximate date describes the object, not the precise year of every event it records.', sourceIds: [source.id], basis: 'history', tradition: null }
};
export function approvedImages(p: StudyPassage): { images: ResearchImage[]; sources: StudySource[] } {
 const relevant = (p.book === 11 && [18, 19].includes(p.chapter)) || (p.book === 22 && [36, 37].includes(p.chapter)) || (p.book === 13 && p.chapter === 32);
 return relevant ? { images: [structuredClone(cylinder)], sources: [structuredClone(source)] } : { images: [], sources: [] };
}
export function resolveImages(ids: string[], available: ResearchImage[]): ResearchImage[] | null {
 if (new Set(ids).size !== ids.length || ids.length > 3) return null;
 const selected = ids.map(id => available.find(image => image.id === id));
 if (selected.some(image => !image || image.id !== cylinder.id || JSON.stringify(image) !== JSON.stringify(cylinder))) return null;
 return selected as ResearchImage[];
}
