/**
 * Structure entry for the `specs/<domain>/*.als` structures this package
 * runs (`specDomains`): registers every structure's snapshot adapters.
 */

// Every `*.binding.ts` under this folder registers itself; a new one
// needs no edit here.
const modules = new Bun.Glob('**/*.binding.ts').scanSync(import.meta.dir);
for (const file of [...modules].sort()) await import(`./${file}`);
