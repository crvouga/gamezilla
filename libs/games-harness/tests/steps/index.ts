/**
 * Steps entry for `specs/games/`: what every game offers alike, run as its
 * own test for each conformance game (every registered game and the
 * reference game) offering what the feature shows, named
 * `<scenario> [<game>]`, in a world where every one of them is offered.
 */

import '@libs/harness/platform';
import '@libs/friends-harness/spaces.steps';
import {
  offersAll,
  sharedSpecificationNeeds,
} from '@libs/games-harness/game-conformance';
import { useHarnessWorld } from '@libs/harness/spec-world';
import { defineScenarioVariants } from '@pkgs/gherkin-shared/registry';
import {
  CONFORMANCE_GAMES,
  openConformanceHarness,
} from '../conformance-world';

defineScenarioVariants((ctx) =>
  CONFORMANCE_GAMES.filter((game) =>
    offersAll(game, sharedSpecificationNeeds(ctx.featureUri))
  ).map((game) => ({ id: game.shared.id, label: game.label }))
);

// Every `*.steps.ts` under this folder registers itself.
const modules = new Bun.Glob('**/*.steps.ts').scanSync(import.meta.dir);
for (const file of [...modules].sort()) await import(`./${file}`);

useHarnessWorld(openConformanceHarness);
