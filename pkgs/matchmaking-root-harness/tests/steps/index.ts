/**
 * Steps entry for this package's features (`specs/matchmaking/*.feature`):
 * registers the matchmaking world and every step definition the features use.
 */

import { useMatchmakingWorld } from './world';

// Every `*.steps.ts` under this folder registers itself; a new one
// needs no edit here.
const modules = new Bun.Glob('**/*.steps.ts').scanSync(import.meta.dir);
for (const file of [...modules].sort()) await import(`./${file}`);

useMatchmakingWorld();
