/**
 * Steps entry for the `specs/hearts/` features: Hearts' own deals, hands,
 * passes, tricks, hearts being broken, scores and winners, in a world where
 * it is the only game. What every game offers alike is specified and run
 * once in `@libs/games-harness-ts`.
 */

import '@libs/harness-ts/platform';
import { useHarnessWorld } from '@libs/harness-ts/spec-world';
import { openHarness } from '../open-hearts-harness';

// Every `*.steps.ts` under this folder registers itself.
const modules = new Bun.Glob('**/*.steps.ts').scanSync(import.meta.dir);
for (const file of [...modules].sort()) await import(`./${file}`);

useHarnessWorld(openHarness);
