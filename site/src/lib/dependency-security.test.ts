import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

// Prevent reintroducing the vulnerable lockfile versions found by the production audit.
// Advisory sources and package-update rationale are documented in site/README.md.
const lock = JSON.parse(readFileSync(new URL('../../package-lock.json', import.meta.url), 'utf8')) as {
 packages: Record<string, { version?: string }>;
};
it.each([
 ['@sveltejs/kit', '3.1.1'],
 ['@sveltejs/adapter-vercel', '7.0.2'],
 ['happy-dom', '21.0.4'],
 ['glob', '14.0.6'],
 ['minimatch', '11.0.1']
])('locks %s to a version with the audited security fixes', (name, minimum) => {
 const versions = Object.entries(lock.packages).filter(([path]) => path.endsWith(`node_modules/${name}`)).map(([, pkg]) => pkg.version!);
 expect(versions.length).toBeGreaterThan(0);
 for (const version of versions) {
  expect(version, `${name} must be a stable patched version`).toMatch(/^\d+\.\d+\.\d+$/);
  expect(version.localeCompare(minimum, 'en', { numeric: true }), `${name}@${version} predates security baseline ${minimum}`).toBeGreaterThanOrEqual(0);
 }
});
