/**
 * Decision-table entry for the `specs/<domain>/*.dmn` tables this package
 * runs (`specDomains`): every table's binding.
 */

// Every `*.binding.ts` under this folder registers itself; a new one
// needs no edit here.
const modules = new Bun.Glob('**/*.binding.ts').scanSync(import.meta.dir);
for (const file of [...modules].sort()) await import(`./${file}`);
