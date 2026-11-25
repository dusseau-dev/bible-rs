import type { DiscoveryKind, DiscoveryStatus, StudyResult } from './study';

const labels: Record<DiscoveryKind, string> = { sources: 'Additional source search', testimonials: 'Testimonial search', papers: 'Paper search', videos: 'Video search' };
export function discoveryNotices(result: StudyResult, filter: string): string[] {
	return (Object.entries(result.discovery ?? {}) as [DiscoveryKind, DiscoveryStatus][])
		.filter(([kind, status]) => status !== 'complete' && (filter === 'all' || kind === filter || (filter === 'academic' && (kind === 'sources' || kind === 'papers')) || (filter === 'history' && kind === 'sources')))
		.map(([kind, status]) => `${labels[kind]} ${({ disabled: 'is not enabled.', rate_limited: 'has reached its limit. Try again later.', failed: 'is temporarily unavailable.', partial: 'is incomplete. Some results may be missing.', complete: '' })[status]}`);
}

export function emptyCategory(result: StudyResult, filter: string): string {
	if (filter === 'videos' || filter === 'testimonials') {
		return result.discovery?.[filter] === 'complete'
			? `No ${filter} matched this passage.`
			: `No reviewed ${filter} are available for this passage.`;
	}
	return filter === 'all' ? 'No notes are available for this passage.' : `No ${filter} notes are available for this passage.`;
}
