import { PlayGameSessionBot } from '@libs/game-session-shared-ts/game-session-commands';
import { GameSessionsAttr } from '@libs/game-session-shared-ts/game-session-state';
import { scenarioAction } from '@libs/harness-ts/actor-ui';
import type { RoomServerApp } from '@libs/spaces-harness-ts/in-process-room-node';
import { readSpaceLink } from '@libs/spaces-harness-ts/spaces-ui-reads';
import { readGameSessionProbe } from './game-session-probe';

/** Redeliver a stale wake, or the other side's wake, without moving time. */
export const redeliverGameSessionBotWake = scenarioAction({
  name: 'redeliverGameSessionBotWake',
  act: async (s, observer: string, kind: 'wrong' | 'stale') => {
    const game = (await readGameSessionProbe(s, observer))?.current;
    const link = await readSpaceLink(s, observer);
    if (game === null || game === undefined || link === null)
      throw new Error('No Game Session to follow');
    const node = s.harness.roomNode as RoomServerApp;
    if (typeof node.dispatchScheduled !== 'function')
      throw new Error('Captured scheduler wakes need the in-process room host');
    const topic = `space:${link.split('/space/')[1]}`;
    // A device may have unuploaded moves. A server wake is stale relative
    // to the committed turn, rather than that device's local board.
    const committed = GameSessionsAttr.from(
      await node.services.read(topic)
    ).current;
    const wakeGame = committed ?? game;
    await node.dispatchScheduled(
      topic,
      PlayGameSessionBot({
        gameId:
          kind === 'stale' && wakeGame.moves.length === 0
            ? `${wakeGame.id}:earlier`
            : wakeGame.id,
        ply:
          kind === 'stale'
            ? Math.max(0, wakeGame.moves.length - 1)
            : wakeGame.moves.length,
        side: wakeGame.turn === 'white' ? 'black' : 'white',
      })
    );
  },
});
