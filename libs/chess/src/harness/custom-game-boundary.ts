import { DEVICE_ID_KEY } from '@libs/auth/public/auth-storage-keys';
import { ensureActor, scenarioAction } from '@libs/harness/system/actor-ui';
import type { ProductHarness } from '@libs/harness/system/harness';
import { answerOfRoomCommand } from '@libs/spaces/harness/room-command-probe';
import type { Timers } from '@pkgs/clock';
import { ChangeCustomGame, type CustomGameChoice } from '../public/custom-game';
import { confirmCustomGameChoice } from '../use-cases/change-custom-game/client/confirm-custom-game-choice';
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
  choice?: CustomGameChoice
): Promise<string> {
  try {
    await confirmCustomGameChoice(
      { room: undefined, timers, pending: new Set() },
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
      let disclosed = false;
      const transport = node.createTransport({
        spaceId: args.spaceId,
        identity,
        installId,
        clientId: env.createId(),
        apiUrl: '',
        timers: env.timers,
        random: env.random,
        getSessionToken: () => null,
      });
      transport.subscribe(() => {
        disclosed = true;
      });
      try {
        await transport.connect();
        rememberReply(s, actor, { reason: '', disclosed });
      } finally {
        transport.destroy();
      }
    } catch (cause) {
      if (
        cause instanceof Error &&
        cause.message === 'harness room: server unreachable'
      ) {
        rememberReply(s, actor, {
          reason: await disconnectedReason(env.timers, args.choice),
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
