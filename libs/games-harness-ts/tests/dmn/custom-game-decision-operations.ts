/** Real custom-game operations behind the access decision table, for every offered game. */
import type { HarnessGame } from '@libs/game-session-harness-ts/harness-game';
import {
  isSimulationHarnessGame,
  isTurnHarnessGame,
} from '@libs/game-session-harness-ts/harness-game';
import type { CustomGameInput } from '@libs/game-session-shared-ts/custom-game-choice';
import {
  capabilityOf,
  spacePresenceOf,
} from '@libs/permissions-shared-ts/people';
import {
  OperationRefused,
  type ServerCase,
  type ServerOperation,
} from '@libs/permissions-shared-ts/server';
import {
  memberIdOf,
  SPACE_ID,
  seedPlaceInSpace,
} from '@libs/spaces-harness-ts/space-decision-world';
import { spaceUserEntityId } from '@libs/spaces-shared-ts/participation-ids';
import { ApplySpaceMembership } from '@libs/spaces-shared-ts/space-service-command';
import sql from '@pkgs/sql-root-shared-ts/sql';
import {
  choice,
  createDecisionRoom,
  decisionConnection,
  type RoomWorld,
  watchDecisionRoom,
} from './custom-game-decision-room';
import { performSimulationControlDecision } from './custom-game-decision-simulation';

const PEER = 'another-participant';

function readyFor(w: RoomWorld, side: 'white' | 'black'): CustomGameInput {
  const setup = isTurnHarnessGame(w.game)
    ? w.game.fixtures.setups?.[side]
    : undefined;
  return { operation: 'ready', ...(setup === undefined ? {} : { setup }) };
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
    await choice(w, w.host, readyFor(w, 'white'));
  }
  if (
    capability === 'cancel a custom game' &&
    spacePresenceOf(w.c.input) === 'guest'
  ) {
    // A participant cancels only a custom game between two people, before each side moved.
    await choice(w, actor, { operation: 'claim', side: 'black' });
    await choice(w, actor, readyFor(w, 'black'));
    await choice(w, w.host, readyFor(w, 'white'));
    await choice(w, w.host, { operation: 'start' });
    return;
  }
  if (capability !== 'play a custom game') return;
  if (spacePresenceOf(w.c.input) === 'guest') {
    await choice(w, w.host, { operation: 'open', side: 'white' });
    await choice(w, actor, { operation: 'claim', side: 'white' });
  }
  await choice(w, PEER, { operation: 'claim', side: 'black' });
  await choice(w, PEER, readyFor(w, 'black'));
  await choice(
    w,
    spacePresenceOf(w.c.input) === 'guest' ? actor : w.host,
    readyFor(w, 'white')
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
      return isTurnHarnessGame(game)
        ? { operation: 'clock', minutes: 5, increment: 2 }
        : { operation: 'difficulty', side: 'black', difficulty: 'easy' };
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
      if (!isTurnHarnessGame(game)) return null;
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
  const w = createDecisionRoom(game, c);
  try {
    await decisionConnection(w, w.host).connect();
    const capability = capabilityOf(c.input);
    await prepare(w, capability);
    if (capability === 'play a custom game' && isSimulationHarnessGame(game)) {
      await performSimulationControlDecision({
        game,
        node: w.node,
        clock: w.clock,
        timers: w.timers,
        nextId: w.nextId,
        host: w.host,
        peer: PEER,
        topic: `space:${SPACE_ID}`,
        actor: memberIdOf(c),
        actorDevice: c.env.deviceId,
      });
      return;
    }
    const input = inputFor(game, capability);
    if (input !== null) await choice(w, memberIdOf(c), input);
    else await watchDecisionRoom(w);
  } finally {
    for (const transport of w.connections.values()) transport.destroy();
    w.node.dispose();
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
    const answers: {
      game: HarnessGame;
      refusal: OperationRefused | null;
    }[] = [];
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
