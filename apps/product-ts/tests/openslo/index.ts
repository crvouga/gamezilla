/**
 * OpenSLO entry for the objectives of this package's `liveDomains`, run by
 * `health --objectives` (`health:objectives`): every binding, on import.
 */

// Every `*.binding.ts` under this folder registers itself; a new one
// needs no edit here.
const modules = new Bun.Glob('**/*.binding.ts').scanSync(import.meta.dir);
for (const file of [...modules].sort()) await import(`./${file}`);
