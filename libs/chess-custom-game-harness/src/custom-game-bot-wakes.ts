import { PlayCustomGameBot } from '@libs/chess-custom-game-shared/custom-game-commands';
import { scenarioAction } from '@libs/harness/actor-ui';
import type { RoomServerApp } from '@libs/spaces-harness/in-process-room-node';
import { readSpaceLink } from '@libs/spaces-harness/spaces-ui-reads';
import { readCustomGameProbe } from './custom-game-ui';

/** Redeliver a stale wake, or the other side's wake, without moving time. */
export const redeliverCustomGameBotWake = scenarioAction({
  name: 'redeliverCustomGameBotWake',
  act: async (s, observer: string, kind: 'wrong' | 'stale') => {
    const game = (await readCustomGameProbe(s, observer))?.current;
    const link = await readSpaceLink(s, observer);
    if (game === null || game === undefined || link === null)
      throw new Error('No Custom Game to follow');
    const node = s.harness.roomNode as RoomServerApp;
    if (typeof node.dispatchScheduled !== 'function')
      throw new Error('Captured scheduler wakes need the in-process room host');
    await node.dispatchScheduled(
      `space:${link.split('/space/')[1]}`,
      PlayCustomGameBot({
        gameId:
          kind === 'stale' && game.moves.length === 0
            ? `${game.id}:earlier`
            : game.id,
        ply:
          kind === 'stale'
            ? Math.max(0, game.moves.length - 1)
            : game.moves.length,
        side: game.turn === 'white' ? 'black' : 'white',
      })
    );
  },
});
