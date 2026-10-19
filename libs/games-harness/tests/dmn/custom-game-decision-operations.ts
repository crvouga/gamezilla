/**
 * The real custom-game operation behind each capability of the
 * custom-game access table, performed in a space's room for every game
 * offering custom games: each game must give the same answer.
 */

import type { HarnessGame } from '@libs/game-session-harness/harness-game';
import { createGameSessionServer } from '@libs/game-session-server/sub-server';
import type { CustomGameInput } from '@libs/game-session-shared/custom-game-choice';
import { ChangeCustomGame } from '@libs/game-session-shared/custom-game-commands';
import { CustomGamesAttr } from '@libs/game-session-shared/custom-game-state';
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
import { createTurnGames } from '@pkgs/turn-game-shared/game-rules';

const OTHER_HOST = 'someone-else';
const PEER = 'another-participant';
type RoomWorld = {
  game: HarnessGame;
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
  if (capability === 'create a custom game') return;
  await choice(w, w.host, { operation: 'create', game: w.game.shared.id });
  if (capability === 'join a custom game' && actor === w.host)
    await choice(w, w.host, { operation: 'release', side: 'white' });
  if (capability === 'start a custom game') {
    await choice(w, w.host, { operation: 'bot', side: 'black' });
    await choice(w, w.host, { operation: 'ready' });
  }
  if (
    capability === 'cancel a custom game' &&
    spacePresenceOf(w.c.input) === 'guest'
  ) {
    // A participant cancels only a custom game between two people, before each side moved.
    await choice(w, actor, { operation: 'claim', side: 'black' });
    await choice(w, actor, { operation: 'ready' });
    await choice(w, w.host, { operation: 'ready' });
    await choice(w, w.host, { operation: 'start' });
    return;
  }
  if (capability !== 'play a custom game') return;
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
function inputFor(
  game: HarnessGame,
  capability: string
): CustomGameInput | null {
  switch (capability) {
    case 'create a custom game':
      return { operation: 'create', game: game.shared.id };
    case 'configure a custom game':
      return { operation: 'clock', minutes: 5, increment: 2 };
    case 'invite a custom game participant':
      return { operation: 'invite', side: 'black', person: PEER };
    case 'configure a custom game bot':
      return { operation: 'bot', side: 'black' };
    case 'start a custom game':
      return { operation: 'start' };
    case 'cancel a custom game':
      return { operation: 'cancel' };
    case 'join a custom game':
      return { operation: 'claim', side: 'black' };
    case 'play a custom game': {
      const move = game.fixtures.firstSideVictory[0];
      if (move === undefined)
        throw new Error(`${game.label} has no first move`);
      return { operation: 'move', uci: move, ply: 0 };
    }
    case 'watch a custom game':
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
async function performFor(game: HarnessGame, c: ServerCase): Promise<void> {
  const { clock, timers } = createHarnessClock({ startMs: c.nowMs });
  let ids = 0;
  const nextId = (): string => `decision-choice-${++ids}`;
  const node = createInProcessRoomNode(
    { clock, timers, createId: nextId, random: () => 0.5, seed: 1n },
    {
      games: [game.shared],
      gateway: {
        roomGrants: async ({ topic, actor }) => {
          const ctx = { db: c.db, topic, actor, nowMs: c.nowMs };
          return [
            ...((await spaceRoomGrants(ctx)) ?? []),
            ...((await createGameSessionServer(
              node.services,
              createTurnGames([game.shared.turnGame])
            ).roomGrants?.(ctx)) ?? []),
          ];
        },
      },
    }
  );
  const host = spacePresenceOf(c.input) === 'host' ? memberIdOf(c) : OTHER_HOST;
  const w = { game, node, timers, c, nextId, host };
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
    const input = inputFor(game, capability);
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
}

/**
 * The capability's operation for each of `games`, which must all answer
 * alike: a refusal by one game alone is a failure naming it.
 */
export function performCustomGameDecision(
  games: readonly HarnessGame[]
): ServerOperation {
  return async (c) => {
    const answers: { game: HarnessGame; refusal: OperationRefused | null }[] =
      [];
    for (const game of games) {
      try {
        await performFor(game, c);
        answers.push({ game, refusal: null });
      } catch (cause) {
        if (!(cause instanceof OperationRefused)) throw cause;
        answers.push({ game, refusal: cause });
      }
    }
    const [first, ...others] = answers;
    if (first === undefined) throw new Error('No game offers custom games');
    for (const other of others)
      if (other.refusal?.message !== first.refusal?.message)
        throw new Error(
          `${first.game.label} answers "${first.refusal?.message ?? 'yes'}" but ${other.game.label} answers "${other.refusal?.message ?? 'yes'}" to ${capabilityOf(c.input)}`
        );
    if (first.refusal !== null) throw first.refusal;
  };
}
