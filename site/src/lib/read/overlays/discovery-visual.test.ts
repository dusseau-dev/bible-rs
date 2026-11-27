import { expect, it } from 'vitest';
import { scale, layoutVisual } from './discovery-visual';
import { fixtureLesson } from '../../server/study/discovery-fixtures';
it('scales equal domains safely and rejects nonfinite or absent coordinates', () => {
 expect(scale(5, 5, 5, 0, 100)).toBe(50);
 expect(() => scale(NaN, 1, 2, 0, 100)).toThrow();
 const visual = fixtureLesson().visual;
 expect(layoutVisual(visual)?.points).toHaveLength(2);
 visual.kind = 'quantitative'; expect(layoutVisual(visual)).toBeNull();
 visual.nodes = []; expect(layoutVisual(visual)).toBeNull();
});
