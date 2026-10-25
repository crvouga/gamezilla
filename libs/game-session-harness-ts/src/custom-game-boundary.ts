import { DEVICE_ID_KEY } from '@libs/auth-shared-ts/auth-storage-keys';
import { confirmCustomGameChoice } from '@libs/game-session-client-ts/confirm-custom-game-choice';
import type { CustomGameChoice } from '@libs/game-session-shared-ts/custom-game-choice';
import { ChangeCustomGame } from '@libs/game-session-shared-ts/custom-game-commands';
import { ensureActor, scenarioAction } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { answerOfRoomCommand } from '@libs/spaces-harness-ts/room-command-probe';
import { roomHistoryDisclosed } from '@libs/spaces-harness-ts/room-history-observation';
import type { Clock, Timers } from '@pkgs/clock-shared-ts/types';
import { createTurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import { readCustomGameIdentity } from './custom-game-identity';

type Reply = { readonly reason: string; readonly disclosed: boolean };
const replies = new WeakMap<ProductHarness, Map<string, Reply>>();

function rememberReply(s: ProductHarness, actor: string, reply: Reply): void {
  let actors = replies.get(s);
  if (actors === undefined) {
    actors = new Map();
    replies.set(s, actors);
  }
  actors.set(actor, reply);
}

async function disconnectedReason(
  timers: Timers,
  clock: Clock,
  choice?: CustomGameChoice
): Promise<string> {
  try {
    await confirmCustomGameChoice(
      {
        room: undefined,
        timers,
        clock,
        canHost: false,
        pending: new Set(),
        // No room on the device: no choice is local, whatever the games.
        rules: createTurnGames([]),
      },
      choice ?? { operation: 'create', gameId: null, revision: 0 }
    );
  } catch (failure) {
    if (!(failure instanceof Error)) throw failure;
    return failure.message;
  }
  throw new Error('A disconnected game choice was unexpectedly confirmed');
}

/** A modified device still reaches the real admission and operation boundaries. */
export const attemptCustomGameBoundary = scenarioAction({
  name: 'attemptCustomGameBoundary',
  act: async (
    s,
    actor: string,
    args: { spaceId: string; choice?: CustomGameChoice }
  ) => {
    await ensureActor(s, actor);
    const env = await s.harness.client(actor);
    if (env.room === undefined)
      throw new Error('modified device has no room transport');
    const node = { ...s.harness.roomNode, createTransport: env.room };
    const identity = await readCustomGameIdentity(s, actor);
    const installId = env.secureStorage.getValue(DEVICE_ID_KEY);
    if (installId === null)
      throw new Error('modified device has no install identity');
    try {
      if (args.choice !== undefined) {
        const answer = await answerOfRoomCommand(node, {
          spaceId: args.spaceId,
          identity,
          installId,
          payload: ChangeCustomGame(args.choice),
          commandId: env.createId(),
          nowMs: s.harness.clock.now(),
          clock: env.clock,
          timers: env.timers,
        });
        const reason =
          answer.kind === 'committed'
            ? ''
            : 'reason' in answer.error
              ? (answer.error.reason ?? answer.error.type)
              : answer.error.type;
        rememberReply(s, actor, { reason, disclosed: true });
        return;
      }
      const transport = node.createTransport({
        topic: `space:${args.spaceId}`,
        module: 'space',
        identity,
        installId,
        clientId: env.createId(),
        apiUrl: '',
        clock: env.clock,
        timers: env.timers,
        random: env.random,
        getSessionToken: () => null,
      });
      try {
        const disclosed = await roomHistoryDisclosed(transport, env.timers);
        rememberReply(s, actor, {
          reason: disclosed ? '' : 'not in the space',
          disclosed,
        });
      } finally {
        transport.destroy();
      }
    } catch (cause) {
      if (
        cause instanceof Error &&
        cause.message === 'harness room: server unreachable'
      ) {
        rememberReply(s, actor, {
          reason: await disconnectedReason(env.timers, env.clock, args.choice),
          disclosed: false,
        });
        return;
      }
      if (!(cause instanceof Error) || cause.message !== 'not in the space')
        throw cause;
      rememberReply(s, actor, { reason: cause.message, disclosed: false });
    }
  },
});

export function readCustomGameBoundary(
  s: ProductHarness,
  actor: string
): Reply | null {
  return replies.get(s)?.get(actor) ?? null;
}
