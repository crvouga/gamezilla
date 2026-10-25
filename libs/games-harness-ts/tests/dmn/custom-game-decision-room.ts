import type { HarnessGame } from '@libs/game-session-harness-ts/harness-game';
import { isTurnHarnessGame } from '@libs/game-session-harness-ts/harness-game';
import { scriptedRandom } from '@libs/game-session-harness-ts/played-rules';
import { createGameSessionServer } from '@libs/game-session-server-ts/sub-server';
import type { CustomGameInput } from '@libs/game-session-shared-ts/custom-game-choice';
import { ChangeCustomGame } from '@libs/game-session-shared-ts/custom-game-commands';
import { CustomGamesAttr } from '@libs/game-session-shared-ts/custom-game-state';
import type { HarnessRoomNode } from '@libs/harness-ts/composition';
import { spacePresenceOf } from '@libs/permissions-shared-ts/people';
import {
  OperationRefused,
  type ServerCase,
} from '@libs/permissions-shared-ts/server';
import { createInProcessRoomNode } from '@libs/spaces-harness-ts/in-process-room-node';
import { answerOfRoomCommand } from '@libs/spaces-harness-ts/room-command-probe';
import { roomHistoryDisclosed } from '@libs/spaces-harness-ts/room-history-observation';
import {
  memberIdOf,
  SPACE_ID,
} from '@libs/spaces-harness-ts/space-decision-world';
import { spaceRoomGrants } from '@libs/spaces-server-ts/space-room-grants';
import {
  createHarnessClock,
  type HarnessClockBundle,
} from '@pkgs/clock-shared-ts/harness-clock';
import type { Message } from '@pkgs/message-shared-ts/message';
import type { ClientTransport } from '@pkgs/room-root-shared-ts/transport';
import { createTurnGames } from '@pkgs/turn-game-shared-ts/game-rules';

export type RoomWorld = HarnessClockBundle & {
  readonly game: HarnessGame;
  readonly node: HarnessRoomNode;
  readonly c: ServerCase;
  readonly nextId: () => string;
  readonly host: string;
  readonly connections: Map<string, ClientTransport>;
};

export function createDecisionRoom(
  game: HarnessGame,
  c: ServerCase
): RoomWorld {
  const time = createHarnessClock({ startMs: c.nowMs });
  let ids = 0;
  const nextId = () => `decision-choice-${++ids}`;
  const rules = createTurnGames([game.shared.registration]);
  const random =
    isTurnHarnessGame(game) && game.fixtures.knownDeal !== undefined
      ? scriptedRandom(game.fixtures.knownDeal.draws)
      : () => 0.5;
  const node = createInProcessRoomNode(
    { ...time, createId: nextId, random, seed: 1n },
    {
      games: [game.shared],
      gateway: {
        roomGrants: async ({ topic, actor }) => {
          const ctx = { db: c.db, topic, actor, nowMs: c.nowMs };
          return [
            ...((await spaceRoomGrants(ctx)) ?? []),
            ...((await createGameSessionServer(
              node.services,
              rules
            ).roomGrants?.(ctx)) ?? []),
          ];
        },
      },
    }
  );
  return {
    ...time,
    game,
    c,
    node,
    nextId,
    connections: new Map(),
    host: spacePresenceOf(c.input) === 'host' ? memberIdOf(c) : 'someone-else',
  };
}

export function decisionConnection(
  w: RoomWorld,
  identity: string
): ClientTransport {
  const existing = w.connections.get(identity);
  if (existing !== undefined) return existing;
  const transport = w.node.createTransport({
    topic: `space:${SPACE_ID}`,
    module: 'space',
    identity,
    installId:
      identity === memberIdOf(w.c) ? w.c.env.deviceId : `${identity}-device`,
    clientId: w.nextId(),
    apiUrl: '',
    clock: w.clock,
    timers: w.timers,
    random: () => 0.5,
    getSessionToken: () => null,
  });
  w.connections.set(identity, transport);
  return transport;
}

async function send(
  w: RoomWorld,
  identity: string,
  payload: Message
): Promise<void> {
  const game = () => {
    const state = w.node.inspect(`space:${SPACE_ID}`)?.committedState;
    return JSON.stringify(
      state === undefined ? null : CustomGamesAttr.from(state)
    );
  };
  let before = game();
  const answer = await answerOfRoomCommand(w.node, {
    spaceId: SPACE_ID,
    identity,
    installId:
      identity === memberIdOf(w.c) ? w.c.env.deviceId : `${identity}-device`,
    payload,
    commandId: w.nextId(),
    nowMs: w.c.nowMs,
    clock: w.clock,
    timers: w.timers,
    transport: decisionConnection(w, identity),
    beforeSend: async () => {
      for (let turn = 0; turn < 4; turn++)
        await w.node.services.read(`space:${SPACE_ID}`);
      before = game();
    },
  });
  if (answer.kind !== 'rejected') return;
  if (game() !== before)
    throw new Error('a denied room command changed the game');
  throw new OperationRefused(answer.error.type);
}

export async function choice(
  w: RoomWorld,
  identity: string,
  input: CustomGameInput
): Promise<void> {
  const transport = decisionConnection(w, identity);
  try {
    if (!transport.isConnected) await transport.connect();
  } catch (cause) {
    if (cause instanceof Error && cause.message === 'not in the space')
      throw new OperationRefused(cause.message);
    throw cause;
  }
  for (let turn = 0; turn < 4; turn++)
    await w.node.services.read(`space:${SPACE_ID}`);
  const state = w.node.inspect(`space:${SPACE_ID}`)?.committedState;
  const game = state === undefined ? null : CustomGamesAttr.from(state).current;
  await send(
    w,
    identity,
    ChangeCustomGame({
      ...input,
      gameId: game?.id ?? null,
      revision: game?.revision ?? 0,
    })
  );
}

export async function watchDecisionRoom(w: RoomWorld): Promise<void> {
  try {
    const disclosed = await roomHistoryDisclosed(
      decisionConnection(w, memberIdOf(w.c)),
      w.timers
    );
    if (!disclosed) throw new OperationRefused('not in the space');
  } catch (cause) {
    if (cause instanceof Error && cause.message === 'not in the space')
      throw new OperationRefused(cause.message);
    throw cause;
  }
}
