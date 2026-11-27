import { expect, it, vi } from 'vitest';
vi.mock('./answer.js', () => ({ requestJson: vi.fn() }));
import { requestJson } from './answer.js';
import { localEvidence } from './evidence';
import { selectDiscoveries } from './discoveries';
import { fixturePacket } from './discovery-fixtures';
it('loads actual public-domain source context for the three editorial cases', async () => {
 for (const passage of [
  { book: 40, chapter: 6, firstVerse: 14, lastVerse: 29 },
  { book: 42, chapter: 1, firstVerse: 1, lastVerse: 5 },
  { book: 18, chapter: 82, firstVerse: 1, lastVerse: 8 }
 ]) {
  const local = await localEvidence(passage);
  const scripture = local.sources.find(s => s.id === 'bible:web');
  expect(scripture?.license).toBe('Public domain');
  expect(local.passageText.length).toBeGreaterThan(100);
  expect(scripture?.excerpt).toContain(local.passageText.split('\n')[0]);
 }
});
it('does not invent discoveries or spend inference on an empty foundation packet', async () => {
 const packet = fixturePacket(); packet.documents = [];
 expect(await selectDiscoveries(packet, 'fixture', AbortSignal.timeout(1000))).toEqual([]);
 expect(requestJson).not.toHaveBeenCalled();
});
