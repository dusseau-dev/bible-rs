import { describe, expect, it } from 'vitest';
import { historyTopicLabel } from './history-topics';

describe('historyTopicLabel', () => {
	it('names the topic with the most keyword hits', () => {
		expect(historyTopicLabel('Roman governors collected tax and tribute in silver coin')).toBe('Economy');
	});

	it('does not label a text from one incidental word', () => {
		expect(historyTopicLabel('Jewish believers knew the law as well as anyone')).toBeNull();
	});
});
