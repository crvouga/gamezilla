import '@libs/account-privacy-harness/privacy.steps';
/**
 * Steps entry for the `specs/<domain>/` features this package runs
 * (`specDomains`): registers the world (this package's harness
 * composition) and every step definition its features may use — the shared
 * platform steps, this package's own, and the profile, billing and friends
 * steps it reuses (a second device, a Plus membership, friendship, and
 * joining a space).
 */

import '@libs/harness/platform';
import '@libs/harness/sounds.steps';
import '@libs/game-matchmaking-harness/matched-game-app.steps';
import '@libs/profile-harness/profile.steps';
import '@libs/profile-harness/auth.steps';
import '@libs/billing-harness/access.steps';
import '@libs/friends-harness/friends.steps';
import '@libs/friends-harness/spaces.steps';
import '@libs/friends-harness/space-offline.steps';
import '@libs/friends-harness/space-idle.steps';
import { heldMatchedGame } from '@libs/game-matchmaking-harness/matched-game-world';
import { setPhoneOfflineHook } from '@libs/harness/platform';
import { useHarnessWorld } from '@libs/harness/spec-world';
import { openSpecHarness } from '../open-chess-harness';

setPhoneOfflineHook(async (w, actor) => {
  const game = await w.s.read(heldMatchedGame, actor);
  if (game !== null) w.memo.set(`multiplayer:offline-board:${actor}`, game);
});

// Every `*.steps.ts` under this folder registers itself; a new one
// needs no edit here.
const modules = new Bun.Glob('**/*.steps.ts').scanSync(import.meta.dir);
for (const file of [...modules].sort()) await import(`./${file}`);

useHarnessWorld(openSpecHarness, (w) => ({
  beforePhoneOffline: (actor: Actor) => rememberOfflineBoard(w, actor),
}));

import type { Actor } from '@libs/harness/parameter-types';

import './multiplayer-game.steps';
import './multiplayer-accessibility.steps';
import './multiplayer-policies.steps';
import { rememberOfflineBoard } from './multiplayer-connection';
