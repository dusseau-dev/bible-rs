import { expect, it } from 'vitest';
import { discoveryNotices, emptyCategory } from './discovery-status';
import type { StudyResult } from './study';
it('does not describe a disabled or failed search as a completed empty search', () => {
	for (const status of ['disabled', 'failed', 'rate_limited', 'partial'] as const) {
		const r = { discovery: { videos: status } } as StudyResult;
		expect(discoveryNotices(r, 'videos')).toHaveLength(1);
		expect(emptyCategory(r, 'videos')).toContain('reviewed');
	}
	const r = { discovery: { videos: 'complete' } } as StudyResult;
	expect(discoveryNotices(r, 'videos')).toEqual([]);
	expect(emptyCategory(r, 'videos')).toContain('matched');
});
it('shows unavailable paper discovery alongside existing Academic notes', () => {
	const r = { discovery: { sources: 'complete', papers: 'disabled', videos: 'failed' } } as StudyResult;
	expect(discoveryNotices(r, 'academic')).toEqual(['Paper search is not enabled.']);
});
