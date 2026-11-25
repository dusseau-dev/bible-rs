// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { place } from './float';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); document.documentElement.removeAttribute('style'); });

describe('popover placement on a phone', () => {
	it('fits above an anchor when the software keyboard reduces available height', () => {
		vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(390);
		vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(844);
		vi.stubGlobal('visualViewport', { height:380, offsetTop:50, scale:1 });
		const result = place(new DOMRect(100, 300, 80, 44), 300, 200, 'bottom', 'center', 8);
		expect(result).toEqual({ x:8, y:92, side:'top' });
	});

	it('keeps menus clear of the landscape notch and home indicator', () => {
		vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(844);
		vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(390);
		vi.stubGlobal('visualViewport', null);
		document.documentElement.style.setProperty('--safe-left', '47px');
		document.documentElement.style.setProperty('--safe-right', '47px');
		document.documentElement.style.setProperty('--safe-bottom', '21px');
		const left = place(new DOMRect(0, 0, 44, 44), 320, 200, 'bottom', 'start', 8);
		expect(left.x).toBe(55);
		const right = place(new DOMRect(820, 370, 24, 20), 320, 200, 'bottom', 'start', 8, false);
		expect(right).toEqual({ x:469, y:161, side:'bottom' });
	});
});
