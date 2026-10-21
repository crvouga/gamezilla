/**
 * Steps entry for `specs/auth/` (this package's `specDomains`): the
 * parameter types, the world, and every step its features use.
 */

import './parameter-types';

import { useSignInWorld } from './world';

// Every `*.steps.ts` under this folder registers itself; a new one
// needs no edit here.
const modules = new Bun.Glob('**/*.steps.ts').scanSync(import.meta.dir);
for (const file of [...modules].sort()) await import(`./${file}`);

useSignInWorld();
