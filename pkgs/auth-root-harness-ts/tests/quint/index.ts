/**
 * Quint entry for this package's models (`specs/auth/*.qnt`): registers
 * the sign-in trace world and every model's binding.
 */

import { useSignInTraceWorld } from './world';

// Every `*.binding.ts` under this folder registers itself; a new one
// needs no edit here.
const modules = new Bun.Glob('**/*.binding.ts').scanSync(import.meta.dir);
for (const file of [...modules].sort()) await import(`./${file}`);

useSignInTraceWorld();
