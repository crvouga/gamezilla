/**
 * Steps entry for the `specs/battleship/` features: Battleship's own fleets,
 * shots, sinkings, victory and bots, in a world where it is the only game.
 * What every game offers, private setups included, is specified and run once
 * in `@libs/games-harness`.
 */

import '@libs/harness/platform';
import { useHarnessWorld } from '@libs/harness/spec-world';
import { openHarness } from '../open-battleship-harness';

// Every `*.steps.ts` under this folder registers itself.
const modules = new Bun.Glob('**/*.steps.ts').scanSync(import.meta.dir);
for (const file of [...modules].sort()) await import(`./${file}`);

useHarnessWorld(openHarness);
