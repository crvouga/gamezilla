/**
 * Steps entry for the `specs/connect-four/` features: Connect Four's own
 * board, drops, endings and bots, in a world where it is the only game.
 * What every game offers is specified and run once in `@libs/games-harness-ts`.
 */

import '@libs/harness-ts/platform';
import { useHarnessWorld } from '@libs/harness-ts/spec-world';
import { openHarness } from '../open-connect-four-harness';

// Every `*.steps.ts` under this folder registers itself.
const modules = new Bun.Glob('**/*.steps.ts').scanSync(import.meta.dir);
for (const file of [...modules].sort()) await import(`./${file}`);

useHarnessWorld(openHarness);
