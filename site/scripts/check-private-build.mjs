import assert from 'node:assert/strict';
import { readdirSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const files = readdirSync('.vercel/output/static', { recursive: true });
const protectedAsset = /^(?:index\.html$|(?:read|api|auth|translations|topics|ark-of-the-covenant)(?:\.html|\/.*\.(?:html|json|bbl))$)/;
assert.deepEqual(files.filter(file => protectedAsset.test(file)), [], 'Protected pages/data must not be exported as public static files');
const { routes } = JSON.parse(readFileSync('.vercel/output/config.json', 'utf8'));
for (const dest of ['/read', '/api/study', '/api/nlt', '/auth/login', '/auth/logout', '/translations/[file]']) {
	assert(routes.some(route => route.dest === dest), `${dest} must reach a server function`);
}
console.log('Private build: protected pages/data reach authenticated server routes.');

// Preview runs from site/, but deployed functions run from the traced bundle root.
const bundle = realpathSync('.vercel/output/functions/read.func');
const config = JSON.parse(readFileSync(resolve(bundle, '.vc-config.json'), 'utf8'));
const nodeModule = resolve(bundle, dirname(config.handler), '../output/server/chunks/node.js');
const cwd = process.cwd();
try {
	process.chdir(bundle);
	const { wasmBytes, translationBytes } = await import(pathToFileURL(nodeModule).href);
	assert.equal(wasmBytes().subarray(0, 4).toString('hex'), '0061736d');
	for (const id of ['kjv', 'bsb', 'web', 'asv', 'dby', 'wbs', 'ylt']) assert(translationBytes(id).length > 0, `${id} must be readable in the deployed function`);
} finally { process.chdir(cwd); }
console.log('Private build: packaged WASM and all seven translations load from the function root.');
