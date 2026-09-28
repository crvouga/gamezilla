/**
 * What a space plays belongs to the space: the host picks chess and everyone
 * in it is taken there. Hosted here because chess is the game composed.
 */

import { chessGameMenuVisible } from '@libs/chess/harness/chess-ui-reads';
import { focusActor } from '@libs/harness';
import { type Actor, Then, When } from '@libs/harness/spec/define';
import { selectChessGame } from '@libs/spaces/harness/space-actions';
import { SECOND_MS } from './puzzle-world';

When('{actor} picks chess for the space', async (w, host: Actor) => {
  await w.s.apply(focusActor, host);
  await w.s.apply(selectChessGame, host);
});

Then(
  '{actor} is taken to chess within {int} seconds',
  async (w, actor: Actor, seconds: number) => {
    await w.s.apply(focusActor, actor);
    await w.s.until((surf) => chessGameMenuVisible(surf, actor), {
      maxMs: seconds * SECOND_MS,
    });
  }
);
