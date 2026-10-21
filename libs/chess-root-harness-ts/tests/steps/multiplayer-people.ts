import { CHESS_GAME_ID } from '@libs/chess-root-harness-ts/chess-playable';
import { prepareNamedFriend } from '@libs/friends-harness-ts/setup-friend-request';
import { givenGameSpace } from '@libs/game-matchmaking-harness-ts/opponent-seeking';
import { attemptPickGame } from '@libs/game-session-harness-ts/space-game-choice';
import { signInWithGoogle } from '@libs/harness-ts/auth-actions';
import { signedInAccountOf } from '@libs/harness-ts/identity';
import { backToTabs } from '@libs/harness-ts/shell-actions';
import type { HarnessWorld } from '@libs/harness-ts/spec-world';
import {
  openProfileEdit,
  setUsername,
} from '@libs/profile-harness-ts/profile-actions';
import { readProfileTabUsername } from '@libs/profile-harness-ts/profile-ui-reads';
import { usernameKey } from '@libs/profile-harness-ts/remembered-username';

/** The person has an account under the username the scenario gave them. */
async function accountNamed(w: HarnessWorld, person: string, username: string) {
  if ((await w.s.read(signedInAccountOf, person)) === null)
    await w.s.apply(signInWithGoogle, person);
  await w.s.apply(backToTabs, person);
  if ((await w.s.read(readProfileTabUsername, person)) === username) return;
  await w.s.apply(openProfileEdit, person);
  await w.s.apply(setUsername, person, username);
}

/**
 * Each person has an account, a username and a space to play in. A person
 * the scenario already gave a username keeps it; anyone else is named after
 * themselves.
 */
export async function multiplayerPeople(
  w: HarnessWorld,
  people: readonly string[]
) {
  for (const person of people) {
    const given = w.memo.get(usernameKey(person));
    if (typeof given === 'string') await accountNamed(w, person, given);
    else await prepareNamedFriend(w.s, person);
    await w.s.apply(givenGameSpace, person);
    await w.s.apply(attemptPickGame, person, CHESS_GAME_ID);
  }
}
