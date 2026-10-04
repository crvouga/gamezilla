/**
 * OpenSLO entry for `specs/sync-engine/*.openslo.yaml` (this package's
 * `specDomains`): every objective binding, registered on import.
 */

// Every `*.binding.ts` under this folder registers itself; a new one
// needs no edit here.
const modules = new Bun.Glob('**/*.binding.ts').scanSync(import.meta.dir);
for (const file of [...modules].sort()) await import(`./${file}`);
