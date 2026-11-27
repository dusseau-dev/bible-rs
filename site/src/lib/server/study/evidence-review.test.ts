import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('./answer.js', () => ({ requestJson: vi.fn() }));
import { requestJson } from './answer.js';
import { quoteOccurs, reviewUnits } from './evidence-review';
import type { ResearchPacket } from './research-packet';
import type { EvidenceUnit } from '#lib/read/discoveries.js';
const unit: EvidenceUnit = { id: 'u', text: 'The inscription names the governor.', sourceIds: ['s'], basis: 'history', tradition: null };
const packet = { documents: [{ role: 'foundation', source: { id: 's', excerpt: 'The inscription names the governor.', kind: 'historical_record' } }] } as ResearchPacket;
const verdict = { unitId: 'u', supported: true, basisSupported: true, supports: [{ sourceId: 's', quote: 'names the governor' }] };
beforeEach(() => vi.clearAllMocks());
it('matches normalized actual excerpts, rejecting invented or trivial quotations', () => {
 expect(quoteOccurs('The inscription names the governor.', 'names the governor')).toBe(true);
 expect(quoteOccurs('The inscription names the governor.', 'records the trial')).toBe(false);
 expect(quoteOccurs('The inscription names the governor.', 'the')).toBe(false);
});
it('accepts support only with an exact, complete and unique reviewer verdict', async () => {
 vi.mocked(requestJson).mockResolvedValue({ assessments: [verdict] });
 expect(await reviewUnits([unit], packet, 'key', AbortSignal.timeout(1000))).toEqual(new Set(['u']));
 for (const assessments of [[verdict, verdict], [], [{ ...verdict, supported: false }], [{ ...verdict, supports: [{ sourceId: 's', quote: 'records the trial' }] }]]) {
  vi.mocked(requestJson).mockResolvedValue({ assessments });
  expect((await reviewUnits([unit], packet, 'key', AbortSignal.timeout(1000))).size).toBe(0);
 }
});
it('rejects forum-only support and a reviewer that does not support the asserted basis', async () => {
 vi.mocked(requestJson).mockResolvedValue({ assessments: [verdict] });
 expect((await reviewUnits([unit], { ...packet, documents: [{ ...packet.documents[0], role: 'lead' }] }, 'key', AbortSignal.timeout(1000))).size).toBe(0);
 vi.mocked(requestJson).mockResolvedValue({ assessments: [{ ...verdict, basisSupported: false }] });
 expect((await reviewUnits([{ ...unit, text: 'He secretly wanted power.' }], packet, 'key', AbortSignal.timeout(1000))).size).toBe(0);
});
