import type { StudyVideo } from '../study';

const VALID: Record<StudyVideo['platform'], RegExp> = {
	youtube: /^[A-Za-z0-9_-]{11}$/,
	tiktok: /^\d{15,22}$/,
	instagram: /^[\w-]{5,40}$/
};
const valid = (v: StudyVideo) => VALID[v.platform]?.test(v.id) ?? false;

/** Poster for the card. YouTube's 4:3 frame is cropped to the vertical picture with object-fit; Reels have none. */
export function posterOf(v: StudyVideo): string | null {
	if (!valid(v)) return null;
	if (v.platform === 'youtube') return `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`;
	return v.thumbnail?.startsWith('https://') ? v.thumbnail : null;
}

/** The platform's own embed player. Loaded only after the reader taps play. */
export function embedOf(v: StudyVideo): string | null {
	if (!valid(v)) return null;
	if (v.platform === 'youtube') return `https://www.youtube-nocookie.com/embed/${v.id}?autoplay=1&playsinline=1&rel=0`;
	if (v.platform === 'tiktok') return `https://www.tiktok.com/player/v1/${v.id}?autoplay=1&rel=0`;
	return `https://www.instagram.com/reel/${v.id}/embed/`;
}
