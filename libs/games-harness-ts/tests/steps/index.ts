/**
 * Steps entry for `specs/games/`: what every game offers alike, run as its
 * own test for each conformance game (every registered game and the
 * reference game) offering what the feature shows, named
 * `<scenario> [<game>]`, in a world where every one of them is offered.
 */

import '@libs/harness-ts/platform';
import '@libs/harness-ts/sounds.steps';
import '@libs/game-matchmaking-harness-ts/matched-game-app.steps';
import '@libs/friends-harness-ts/spaces.steps';
import '@libs/friends-harness-ts/space-offline.steps';
import '@libs/friends-harness-ts/space-idle.steps';
import '@libs/friends-harness-ts/space-unreachable.steps';
import '@libs/friends-harness-ts/friends.steps';
import '@libs/profile-harness-ts/profile.steps';
import '@libs/profile-harness-ts/auth.steps';
import '@libs/account-privacy-harness-ts/privacy.steps';
import '@libs/account-privacy-harness-ts/exports.steps';
import { sharedSpecificationNeeds } from '@libs/games-harness-ts/game-conformance';
import type { Actor } from '@libs/harness-ts/parameter-types';
import { useHarnessWorld } from '@libs/harness-ts/spec-world';
import { defineScenarioVariants } from '@pkgs/gherkin-shared-ts/registry';
import {
  conformanceVariants,
  declareRequiredGames,
  openConformanceHarness,
} from '../conformance-world';
import { customGameBeforeDeletion } from './custom-game-privacy.steps';
import { puzzleProgressBeforeDeletion } from './deleted-account-progress.steps';
import { deviceOffline, playsMatchedGames } from './matched-game-connection';

defineScenarioVariants((ctx) => conformanceVariants(ctx.featureUri));
declareRequiredGames();

// Every `*.steps.ts` under this folder registers itself.
const modules = new Bun.Glob('**/*.steps.ts').scanSync(import.meta.dir);
for (const file of [...modules].sort()) await import(`./${file}`);

useHarnessWorld(openConformanceHarness, (w) => ({
  // A deleted account had puzzle progress at the run's game, in a feature
  // about puzzles, and otherwise a custom game of it.
  beforeAccountDeletion: (actor: Actor) =>
    sharedSpecificationNeeds(w.ctx.featureUri).includes('puzzles')
      ? puzzleProgressBeforeDeletion(w, actor)
      : customGameBeforeDeletion(w, actor),
  // A phone going offline keeps the matched game or search it showed.
  beforePhoneOffline: async (actor: Actor) => {
    if (playsMatchedGames(w, actor)) await deviceOffline(w, actor);
  },
}));
