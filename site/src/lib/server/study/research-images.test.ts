import { expect, it } from 'vitest';
import { approvedImages, resolveImages } from './research-images';
it('offers the verified cylinder only for its relevant passage and preserves server-owned rights', () => {
 const { images } = approvedImages({ book: 11, chapter: 18, firstVerse: 13, lastVerse: 16 });
 expect(images).toHaveLength(1);
 expect(images[0].license).toBe('CC0 1.0');
 expect(resolveImages([images[0].id], images)).toEqual(images);
 expect(resolveImages(['https://unverified.test/image.jpg'], images)).toBeNull();
 expect(resolveImages([images[0].id], [{ ...images[0], license: 'Unknown' }])).toBeNull();
 expect(approvedImages({ book: 0, chapter: 1, firstVerse: 1, lastVerse: 1 }).images).toEqual([]);
});
