import { DEVICE_ID_KEY } from '@libs/auth-shared/auth-storage-keys';
import { scenarioAction } from '@libs/harness/actor-ui';
import { answerOfRoomCommand } from '@libs/spaces-harness/room-command-probe';
import { ChangeCustomGame } from '@libs/chess-custom-game-shared/custom-game-commands';
import { CustomGamesAttr } from '@libs/chess-custom-game-shared/custom-game-state';

/** Acquire a legal historical position through the real server's move boundary. */
export const playCustomGameHistory = scenarioAction({
  name: 'playCustomGameHistory',
  act: async (
    s,
    args: {
      spaceId: string;
      white: string;
      black: string;
      moves: readonly string[];
    }
  ) => {
    const devices = {
      white: await s.harness.client(args.white),
      black: await s.harness.client(args.black),
    };
    for (const uci of args.moves) {
      const state = s.harness.roomNode.inspect(
        `space:${args.spaceId}`
      )?.committedState;
      if (state === undefined) throw new Error('history has no room');
      const game = CustomGamesAttr.from(state).current;
      if (
        game === null ||
        game.status !== 'active' ||
        game[game.turn].kind !== 'person'
      )
        throw new Error('history needs an active game with people');
      const env = devices[game.turn];
      const installId = env.secureStorage.getValue(DEVICE_ID_KEY);
      if (installId === null) throw new Error('history device has no identity');
      const answer = await answerOfRoomCommand(s.harness.roomNode, {
        spaceId: args.spaceId,
        identity: game[game.turn].person,
        installId,
        payload: ChangeCustomGame({
          operation: 'move',
          uci,
          ply: game.moves.length,
          gameId: game.id,
          revision: game.revision,
        }),
        commandId: env.createId(),
        nowMs: s.harness.clock.now(),
        timers: env.timers,
      });
      if (answer.kind === 'rejected')
        throw new Error(
          `historical move ${uci} refused: ${'reason' in answer.error ? answer.error.reason : answer.error.type}`
        );
    }
    await s.session.advanceTime(0);
  },
});
