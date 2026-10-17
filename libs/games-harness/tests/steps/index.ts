/**
 * Steps entry for `specs/games/`: what every game offers alike, run as its
 * own test for each conformance game (every registered game and the
 * reference game) offering what the feature shows, named
 * `<scenario> [<game>]`, in a world where every one of them is offered.
 */

import '@libs/harness/platform';
import '@libs/harness/sounds.steps';
import '@libs/game-matchmaking-harness/matched-game-app.steps';
import '@libs/friends-harness/spaces.steps';
import '@libs/friends-harness/space-offline.steps';
import '@libs/friends-harness/friends.steps';
import '@libs/profile-harness/profile.steps';
import '@libs/profile-harness/auth.steps';
import '@libs/account-privacy-harness/privacy.steps';
import '@libs/account-privacy-harness/exports.steps';
import type { Actor } from '@libs/harness/parameter-types';
import { useHarnessWorld } from '@libs/harness/spec-world';
import { defineScenarioVariants } from '@pkgs/gherkin-shared/registry';
import { gamesHeldTo, openConformanceHarness } from '../conformance-world';
import { customGameBeforeDeletion } from './custom-game-privacy.steps';

defineScenarioVariants((ctx) =>
  gamesHeldTo(ctx.featureUri).map((game) => ({
    id: game.shared.id,
    label: game.label,
  }))
);

// Every `*.steps.ts` under this folder registers itself.
const modules = new Bun.Glob('**/*.steps.ts').scanSync(import.meta.dir);
for (const file of [...modules].sort()) await import(`./${file}`);

useHarnessWorld(openConformanceHarness, (w) => ({
  // A deleted account had a custom game of the run's game.
  beforeAccountDeletion: (actor: Actor) => customGameBeforeDeletion(w, actor),
}));
