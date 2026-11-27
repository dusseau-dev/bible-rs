import Ajv from 'ajv';
import type { Discovery, EvidenceUnit, Lesson } from '#lib/read/discoveries.js';

const str = { type: 'string', minLength: 1, maxLength: 8000 };
const nullableString = { type: ['string', 'null'], maxLength: 500 };
const number = { type: ['number', 'null'] };
const list = (items: object, minItems = 1, maxItems = 100) => ({ type: 'array', items, minItems, maxItems });
const object = (properties: Record<string, object>) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const choice = (...values: string[]) => ({ type: 'string', enum: values });
export const unitSchema = object({ id: { ...str, maxLength: 100 }, text: str, sourceIds: list({ ...str, maxLength: 500 }, 1, 16), basis: choice('text', 'history', 'inference', 'interpretation'), tradition: { enum: [null, 'protestant', 'catholic', 'orthodox', 'jewish'] } });
const passageSchema = object({ book: { type: 'integer', minimum: 0, maximum: 65 }, chapter: { type: 'integer', minimum: 1, maximum: 150 }, firstVerse: { type: 'integer', minimum: 1, maximum: 176 }, lastVerse: { type: 'integer', minimum: 1, maximum: 176 } });
export const discoverySchema = object({ id: str, category: choice('history', 'related', 'academic', 'reflection'), title: unitSchema, explanation: list(unitSchema, 1, 8), payoff: unitSchema });
export const discoveriesSchema = object({ items: list(discoverySchema, 0, 5) });
const visualSchema = object({
 kind: choice('relationships', 'timeline', 'structure', 'geography', 'quantitative'),
 nodes: list(object({ id: str, label: unitSchema, x: number, y: number, xLow: number, xHigh: number, yLow: number, yHigh: number }), 2, 12),
 edges: list(object({ from: str, to: str, label: unitSchema }), 0, 20),
 xLabel: nullableString, yLabel: nullableString, xUnit: nullableString, yUnit: nullableString,
 explanation: unitSchema, limitations: str
});
const imageSchema = object({ id: str, src: str, sourceUrl: str, sourceId: str, credit: str, license: str, licenseUrl: str, date: nullableString, provenance: nullableString, depiction: choice('artifact', 'manuscript', 'excavation', 'reconstruction', 'artwork'), alt: str, caption: unitSchema });
export const lessonSchema = object({ discoveryId: str,
 sections: list(object({ kind: choice('discovery', 'passage', 'evidence', 'disagreement', 'payoff'), units: list(unitSchema, 1, 40) }), 5, 5),
 exercise: object({ passages: list(passageSchema, 2, 4), questions: list(str, 3, 3) }),
 visual: visualSchema, images: list(imageSchema, 0, 3)
});
const ajv = new Ajv({ strict: true, allowUnionTypes: true });
const validDiscoveries = ajv.compile(list(discoverySchema, 0, 5));
const validLesson = ajv.compile(lessonSchema);
export const wordCount = (text: string) => text.trim().match(/\S+/gu)?.length ?? 0;
export const discoveryUnits = (d: Discovery): EvidenceUnit[] => [d.title, ...d.explanation, d.payoff];
export const lessonUnits = (l: Lesson): EvidenceUnit[] => [...l.sections.flatMap(s => s.units), ...l.visual.nodes.map(n => n.label), ...l.visual.edges.map(e => e.label), l.visual.explanation, ...l.images.map(i => i.caption)];
function unitsValid(units: EvidenceUnit[], known: Set<string>): boolean {
 return new Set(units.map(u => u.id)).size === units.length && units.every(u => u.text.trim() && new Set(u.sourceIds).size === u.sourceIds.length && u.sourceIds.every(id => known.has(id)));
}
export function parseDiscoveries(raw: unknown, known: Set<string>): Discovery[] {
 if (!validDiscoveries(raw)) return [];
 const items = raw as Discovery[];
 if (new Set(items.map(i => i.id)).size !== items.length) return [];
 return items.filter(d => {
  const count = wordCount([...d.explanation, d.payoff].map(u => u.text).join(' '));
  return d.title.text.length <= 150 && count >= 80 && count <= 120 && unitsValid(discoveryUnits(d), known);
 });
}
export function parseLesson(raw: unknown, known: Set<string>): Lesson | null {
 if (!validLesson(raw)) return null;
 const l = raw as Lesson;
 if (l.sections.map(s => s.kind).join(',') !== 'discovery,passage,evidence,disagreement,payoff' || !unitsValid(lessonUnits(l), known)) return null;
 const words = wordCount([...l.sections.flatMap(s => s.units.map(u => u.text)), ...l.exercise.questions].join(' '));
 if (words < 900 || words > 1200 || l.exercise.passages.some(p => p.lastVerse < p.firstVerse)) return null;
 const v = l.visual, ids = new Set(v.nodes.map(n => n.id));
 if (ids.size !== v.nodes.length || v.edges.some(e => !ids.has(e.from) || !ids.has(e.to) || e.from === e.to)) return null;
 for (const n of v.nodes) {
  for (const axis of ['x', 'y'] as const) {
   const value = n[axis], low = n[`${axis}Low`], high = n[`${axis}High`];
   if ((low !== null || high !== null) && (value === null || (low !== null && low > value) || (high !== null && high < value))) return null;
  }
  if (['timeline', 'geography', 'quantitative'].includes(v.kind) && n.x === null) return null;
  if (['geography', 'quantitative'].includes(v.kind) && n.y === null) return null;
  if (v.kind === 'geography' && (Math.abs(n.x!) > 180 || Math.abs(n.y!) > 90)) return null;
 }
 if (v.kind === 'quantitative' && (!v.xLabel || !v.yLabel || !v.xUnit || !v.yUnit)) return null;
 if (l.images.some(i => !known.has(i.sourceId) || [i.src, i.sourceUrl, i.licenseUrl].some(url => { try { return new URL(url).protocol !== 'https:'; } catch { return true; } }))) return null;
 return l;
}
