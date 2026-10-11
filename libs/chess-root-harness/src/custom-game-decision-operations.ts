import type { CustomGameInput } from '@libs/chess-custom-game-shared/custom-game-choice';
import { ChangeCustomGame } from '@libs/chess-custom-game-shared/custom-game-commands';
import { CustomGamesAttr } from '@libs/chess-custom-game-shared/custom-game-state';
import { createChessServer } from '@libs/chess-root-server/sub-server';
import { chessGameShared } from '@libs/chess-sub-shared/chess-game';
import type { HarnessRoomNode } from '@libs/harness/composition';
import { capabilityOf, spacePresenceOf } from '@libs/permissions-shared/people';
import type {
  ServerCase,
  ServerOperation,
} from '@libs/permissions-shared/server';
import { OperationRefused } from '@libs/permissions-shared/server';
import { createInProcessRoomNode } from '@libs/spaces-harness/in-process-room-node';
import { answerOfRoomCommand } from '@libs/spaces-harness/room-command-probe';
import { roomHistoryDisclosed } from '@libs/spaces-harness/room-history-observation';
import {
  memberIdOf,
  SPACE_ID,
  seedPlaceInSpace,
} from '@libs/spaces-harness/space-decision-world';
import { spaceRoomGrants } from '@libs/spaces-server/space-room-grants';
import { spaceUserEntityId } from '@libs/spaces-shared/participation-ids';
import { ApplySpaceMembership } from '@libs/spaces-shared/space-service-command';
import { createHarnessClock } from '@pkgs/clock-shared/harness-clock';
import type { Timers } from '@pkgs/clock-shared/types';
import type { Message } from '@pkgs/message-shared/message';
import sql from '@pkgs/sql-root-shared/sql';

const OTHER_HOST = 'someone-else';
const PEER = 'another-participant';
type RoomWorld = {
  node: HarnessRoomNode;
  timers: Timers;
  c: ServerCase;
  nextId: () => string;
  host: string;
};

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
  const before = game();
  try {
    const answer = await answerOfRoomCommand(w.node, {
      spaceId: SPACE_ID,
      identity,
      installId:
        identity === memberIdOf(w.c) ? w.c.env.deviceId : `${identity}-device`,
      payload,
      commandId: w.nextId(),
      nowMs: w.c.nowMs,
      timers: w.timers,
    });
    if (answer.kind !== 'rejected') return;
    if (game() !== before)
      throw new Error('a denied room command changed the game');
    throw new OperationRefused(answer.error.type);
  } catch (cause) {
    if (cause instanceof Error && cause.message === 'not in the space')
      throw new OperationRefused(cause.message);
    throw cause;
  }
}
async function choice(
  w: RoomWorld,
  identity: string,
  input: CustomGameInput
): Promise<void> {
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
async function prepare(w: RoomWorld, capability: string): Promise<void> {
  const join = (memberId: string) =>
    w.node.services.send(
      `space:${SPACE_ID}`,
      w.nextId(),
      ApplySpaceMembership({ memberId, change: 'joined' })
    );
  await join(w.host);
  await join(PEER);
  const actor = memberIdOf(w.c);
  if (spacePresenceOf(w.c.input) === 'guest') await join(actor);
  if (capability === 'create a Custom Game') return;
  await choice(w, w.host, { operation: 'create' });
  if (capability === 'join a Custom Game' && actor === w.host)
    await choice(w, w.host, { operation: 'release', side: 'white' });
  if (capability === 'start a Custom Game') {
    await choice(w, w.host, { operation: 'bot', side: 'black' });
    await choice(w, w.host, { operation: 'ready' });
  }
  if (
    capability === 'cancel a Custom Game' &&
    spacePresenceOf(w.c.input) === 'guest'
  ) {
    // A participant cancels only a game between two people, before each side moved.
    await choice(w, actor, { operation: 'claim', side: 'black' });
    await choice(w, actor, { operation: 'ready' });
    await choice(w, w.host, { operation: 'ready' });
    await choice(w, w.host, { operation: 'start' });
    return;
  }
  if (capability !== 'play a Custom Game') return;
  if (spacePresenceOf(w.c.input) === 'guest') {
    await choice(w, w.host, { operation: 'open', side: 'white' });
    await choice(w, actor, { operation: 'claim', side: 'white' });
  }
  await choice(w, PEER, { operation: 'claim', side: 'black' });
  await choice(w, PEER, { operation: 'ready' });
  await choice(w, spacePresenceOf(w.c.input) === 'guest' ? actor : w.host, {
    operation: 'ready',
  });
  await choice(w, w.host, { operation: 'start' });
}
function inputFor(capability: string): CustomGameInput | null {
  switch (capability) {
    case 'create a Custom Game':
      return { operation: 'create' };
    case 'configure a Custom Game':
      return { operation: 'clock', minutes: 5, increment: 2 };
    case 'invite a Custom Game participant':
      return { operation: 'invite', side: 'black', person: PEER };
    case 'configure a Custom Game bot':
      return { operation: 'bot', side: 'black' };
    case 'start a Custom Game':
      return { operation: 'start' };
    case 'cancel a Custom Game':
      return { operation: 'cancel' };
    case 'join a Custom Game':
      return { operation: 'claim', side: 'black' };
    case 'play a Custom Game':
      return { operation: 'move', uci: 'e2e4', ply: 0 };
    case 'watch a Custom Game':
      return null;
    default:
      throw new Error(`no operation for ${capability}`);
  }
}
export async function seedCustomGameDecision(c: ServerCase): Promise<void> {
  await seedPlaceInSpace(c);
  const at = new Date(c.nowMs).toISOString();
  await c.db.run(
    sql`INSERT INTO spaces_users (id, space_id, user_id, created_at, updated_at, joined, participation_revision) VALUES (${spaceUserEntityId(SPACE_ID, PEER)}, ${SPACE_ID}, ${PEER}, ${at}, ${at}, ${true}, ${0})`
  );
}
export const performCustomGameDecision: ServerOperation = async (c) => {
  const { clock, timers } = createHarnessClock({ startMs: c.nowMs });
  let ids = 0;
  const nextId = (): string => `decision-choice-${++ids}`;
  const node = createInProcessRoomNode(
    { clock, timers, createId: nextId, random: () => 0.5, seed: 1n },
    {
      games: [chessGameShared],
      gateway: {
        roomGrants: async ({ topic, actor }) => {
          const ctx = { db: c.db, topic, actor, nowMs: c.nowMs };
          return [
            ...((await spaceRoomGrants(ctx)) ?? []),
            ...((await createChessServer(node.services).roomGrants?.(ctx)) ??
              []),
          ];
        },
      },
    }
  );
  const host = spacePresenceOf(c.input) === 'host' ? memberIdOf(c) : OTHER_HOST;
  const w = { node, timers, c, nextId, host };
  const hosting = node.createTransport({
    topic: `space:${SPACE_ID}`,
    module: 'space',
    identity: host,
    installId: host === memberIdOf(c) ? c.env.deviceId : `${host}-device`,
    clientId: nextId(),
    apiUrl: '',
    timers,
    random: () => 0.5,
    getSessionToken: () => null,
  });
  try {
    await hosting.connect();
    const capability = capabilityOf(c.input);
    await prepare(w, capability);
    const input = inputFor(capability);
    if (input !== null) await choice(w, memberIdOf(c), input);
    else {
      const transport = node.createTransport({
        topic: `space:${SPACE_ID}`,
        module: 'space',
        identity: memberIdOf(c),
        installId: c.env.deviceId,
        clientId: nextId(),
        apiUrl: '',
        timers,
        random: () => 0.5,
        getSessionToken: () => null,
      });
      try {
        const disclosed = await roomHistoryDisclosed(transport, timers);
        if (!disclosed) throw new OperationRefused('not in the space');
      } catch (cause) {
        if (cause instanceof Error && cause.message === 'not in the space')
          throw new OperationRefused(cause.message);
        throw cause;
      } finally {
        transport.destroy();
      }
    }
  } finally {
    hosting.destroy();
    node.dispose();
  }
};
