import { givenMultiplayerSpace } from '@libs/chess-matchmaking-harness/multiplayer-spaces';
import { prepareNamedFriend } from '@libs/friends-harness/setup-friend-request';
import type { HarnessWorld } from '@libs/harness/spec-world';

export async function multiplayerPeople(
  w: HarnessWorld,
  people: readonly string[]
) {
  for (const person of people) {
    await prepareNamedFriend(w.s, person);
    await w.s.apply(givenMultiplayerSpace, person);
  }
}
