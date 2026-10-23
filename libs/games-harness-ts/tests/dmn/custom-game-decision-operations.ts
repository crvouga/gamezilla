/**
 * The real custom-game operation behind each capability of the
 * custom-game access table, performed in a space's room for every game
 * offering custom games: each game must give the same answer.
 */

import type { HarnessGame } from '@libs/game-session-harness-ts/harness-game';
import { createGameSessionServer } from '@libs/game-session-server-ts/sub-server';
import type { CustomGameInput } from '@libs/game-session-shared-ts/custom-game-choice';
import { ChangeCustomGame } from '@libs/game-session-shared-ts/custom-game-commands';
import { CustomGamesAttr } from '@libs/game-session-shared-ts/custom-game-state';
import type { HarnessRoomNode } from '@libs/harness-ts/composition';
import {
  capabilityOf,
  spacePresenceOf,
} from '@libs/permissions-shared-ts/people';
import type {
  ServerCase,
  ServerOperation,
} from '@libs/permissions-shared-ts/server';
import { OperationRefused } from '@libs/permissions-shared-ts/server';
import { createInProcessRoomNode } from '@libs/spaces-harness-ts/in-process-room-node';
import { answerOfRoomCommand } from '@libs/spaces-harness-ts/room-command-probe';
import { roomHistoryDisclosed } from '@libs/spaces-harness-ts/room-history-observation';
import {
  memberIdOf,
  SPACE_ID,
  seedPlaceInSpace,
} from '@libs/spaces-harness-ts/space-decision-world';
import { spaceRoomGrants } from '@libs/spaces-server-ts/space-room-grants';
import { spaceUserEntityId } from '@libs/spaces-shared-ts/participation-ids';
import { ApplySpaceMembership } from '@libs/spaces-shared-ts/space-service-command';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import type { Timers } from '@pkgs/clock-shared-ts/types';
import type { Message } from '@pkgs/message-shared-ts/message';
import sql from '@pkgs/sql-root-shared-ts/sql';
import {
  createTurnGames,
  GAME_SIDES,
  type GameSide,
  gameSides,
} from '@pkgs/turn-game-shared-ts/game-rules';

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

async function ready(w: RoomWorld, identity: string, side: GameSide) {
  const setup = w.game.fixtures.setups?.[side];
  await choice(w, identity, {
    operation: 'ready',
    ...(setup === undefined ? {} : { setup }),
  });
}

function peerForSide(side: GameSide) {
  return side === 'black' ? PEER : `${PEER}-${side}`;
}

async function fillExtraSides(w: RoomWorld) {
  for (const side of gameSides(w.game.shared.turnGame.rules).slice(2)) {
    const person = peerForSide(side);
    await w.node.services.send(
      `space:${SPACE_ID}`,
      w.nextId(),
      ApplySpaceMembership({ memberId: person, change: 'joined' })
    );
    await choice(w, person, { operation: 'claim', side });
    await ready(w, person, side);
  }
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
    for (const side of gameSides(w.game.shared.turnGame.rules).slice(1))
      await choice(w, w.host, { operation: 'bot', side });
    await ready(w, w.host, 'white');
    return;
  }
  if (
    capability === 'cancel a custom game' &&
    spacePresenceOf(w.c.input) === 'guest'
  ) {
    // A participant cancels only a game between people, before each side moved.
    await choice(w, actor, { operation: 'claim', side: 'black' });
    await fillExtraSides(w);
    await ready(w, actor, 'black');
    await ready(w, w.host, 'white');
    await choice(w, w.host, { operation: 'start' });
    return;
  }
  if (capability !== 'play a custom game') return;
  if (spacePresenceOf(w.c.input) === 'guest') {
    await choice(w, w.host, { operation: 'open', side: 'white' });
    await choice(w, actor, { operation: 'claim', side: 'white' });
  }
  await choice(w, PEER, { operation: 'claim', side: 'black' });
  await fillExtraSides(w);
  await ready(w, PEER, 'black');
  await ready(
    w,
    spacePresenceOf(w.c.input) === 'guest' ? actor : w.host,
    'white'
  );
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
  for (const side of GAME_SIDES.slice(1)) {
    const person = peerForSide(side);
    await c.db.run(
      sql`INSERT INTO spaces_users (id, space_id, user_id, created_at, updated_at, joined, participation_revision) VALUES (${spaceUserEntityId(SPACE_ID, person)}, ${SPACE_ID}, ${person}, ${at}, ${at}, ${true}, ${0})`
    );
  }
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
