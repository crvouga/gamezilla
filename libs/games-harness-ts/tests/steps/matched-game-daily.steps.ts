/**
 * A daily game lasting across spaces: its person may end one space and
 * host another, and the daily game is still theirs.
 */

import { givenGameSpace } from '@libs/game-matchmaking-harness-ts/opponent-seeking';
import { Given } from '@libs/harness-ts/define';

Given('{actor} is hosting another space', async (w, actor: string) => {
  await w.s.apply(givenGameSpace, actor);
});
