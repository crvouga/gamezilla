import { DEVICE_ID_KEY } from '@libs/auth-shared-ts/auth-storage-keys';
import { ChangeCustomGame } from '@libs/game-session-shared-ts/custom-game-commands';
import { CustomGamesAttr } from '@libs/game-session-shared-ts/custom-game-state';
import { scenarioAction } from '@libs/harness-ts/actor-ui';
import {
  openRoomCommandProbe,
  type RoomCommandProbe,
} from '@libs/spaces-harness-ts/room-command-probe';
import type { CustomGame } from '@libs/game-session-shared-ts/custom-game-state';
import { splitCommittedProposal } from './played-rules';

/**
 * The room commands an earlier history's proposal is: a move by the side to
 * move or, for a phase of private commitments, every committing side's own
 * commitment in seat order.
 */
function historyChoices(
  game: CustomGame,
  proposal: string
): readonly { readonly side: CustomGame['turn']; readonly payload: ReturnType<typeof ChangeCustomGame> }[] {
  const reference = {
    ply: game.moves.length,
    gameId: game.id,
    revision: game.revision,
  };
  const commitments = splitCommittedProposal(proposal);
  if (commitments === null)
    return [
      {
        side: game.turn,
        payload: ChangeCustomGame({ operation: 'move', uci: proposal, ...reference }),
      },
    ];
  if (commitments.length !== game.awaiting.length)
    throw new Error('history commits for every committing side');
  return game.awaiting.map((side, index) => ({
    side,
    payload: ChangeCustomGame({
      operation: 'commit',
      commitment: commitments[index]!,
      ...reference,
    }),
  }));
}

/** Acquire a legal historical position through the real server's move boundary. */
export const playCustomGameHistory = scenarioAction({
  name: 'playCustomGameHistory',
  act: async (
    s,
    args: {
      spaceId: string;
      white: string;
      black: string;
      red?: string;
      blue?: string;
      moves: readonly string[];
    }
  ) => {
    const devices = new Map<
      string,
      Awaited<ReturnType<typeof s.harness.client>>
    >();
    for (const side of ['white', 'black', 'red', 'blue'] as const) {
      const person = args[side];
      if (person !== undefined)
        devices.set(side, await s.harness.client(person));
    }
    // One connection per seat for the whole history, as each device keeps
    // its own: no roster change between two historical moves.
    const probes = new Map<string, RoomCommandProbe>();
    const probeOf = async (side: CustomGame['turn'], person: string) => {
      const known = probes.get(side);
      if (known !== undefined) return known;
      const env = devices.get(side);
      const installId = env?.secureStorage.getValue(DEVICE_ID_KEY) ?? null;
      if (env === undefined || installId === null)
        throw new Error('history has no device for the seat');
      const probe = await openRoomCommandProbe(s.harness.roomNode, {
        spaceId: args.spaceId,
        identity: person,
        installId,
        clientId: env.createId(),
        timers: env.timers,
      });
      if (probe === null) throw new Error('history seat is not in the space');
      probes.set(side, probe);
      return probe;
    };
    try {
      for (const uci of args.moves) {
        const state = s.harness.roomNode.inspect(
          `space:${args.spaceId}`
        )?.committedState;
        if (state === undefined) throw new Error('history has no room');
        const game = CustomGamesAttr.from(state).current;
        if (game === null || game.status !== 'active')
          throw new Error('history needs an active game');
        for (const choice of historyChoices(game, uci)) {
          if (game[choice.side].kind !== 'person')
            throw new Error('history needs a person on every seat');
          const probe = await probeOf(choice.side, game[choice.side].person);
          const answer = await probe.send({
            payload: choice.payload,
            commandId: devices.get(choice.side)!.createId(),
            nowMs: s.harness.clock.now(),
          });
          if (answer.kind === 'rejected')
            throw new Error(
              `historical move ${uci} refused: ${'reason' in answer.error ? answer.error.reason : answer.error.type}`
            );
        }
      }
    } finally {
      for (const probe of probes.values()) probe.close();
    }
    await s.session.advanceTime(0);
  },
});
