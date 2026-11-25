/**
 * Server-only Bible files. Vite runs from site/; the Vercel function bundle contains both
 * site/ and data/ and runs from their parent directory.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const siteRoot = existsSync(resolve('src/lib/read/wasm/bible_bg.wasm')) ? '.' : 'site';

export const wasmBytes = () => readFileSync(resolve(siteRoot, 'src/lib/read/wasm/bible_bg.wasm'));

export function translationBytes(id: string): Uint8Array {
	if (!/^[a-z0-9-]+$/.test(id)) throw new Error(`no translation ${id}`);
	return readFileSync(resolve(siteRoot, '../data/translations', `${id}.bbl`));
}
