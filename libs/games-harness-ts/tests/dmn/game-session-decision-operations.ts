/** Real game-session operations behind the access decision table, for every offered game. */
import type { HarnessGame } from '@libs/game-session-harness-ts/harness-game';
import {
  isSimulationHarnessGame,
  isTurnHarnessGame,
} from '@libs/game-session-harness-ts/harness-game';
import type { GameSessionInput } from '@libs/game-session-shared-ts/game-session-choice';
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
  GAME_SIDES,
  type GameSide,
  gameSides,
} from '@pkgs/turn-game-shared-ts/game-rules';
import {
  choice,
  createDecisionRoom,
  decisionConnection,
  type RoomWorld,
  watchDecisionRoom,
} from './game-session-decision-room';
import { performSimulationControlDecision } from './game-session-decision-simulation';

const PEER = 'another-participant';

function readyFor(w: RoomWorld, side: GameSide): GameSessionInput {
  const setup = isTurnHarnessGame(w.game)
    ? w.game.fixtures.setups?.[side]
    : undefined;
  return { operation: 'ready', ...(setup === undefined ? {} : { setup }) };
}

function peerForSide(side: GameSide) {
  return side === 'black' ? PEER : `${PEER}-${side}`;
}

async function fillExtraSides(w: RoomWorld) {
  for (const side of gameSides(w.game.shared.registration.rules).slice(2)) {
    const person = peerForSide(side);
    await w.node.services.send(
      `space:${SPACE_ID}`,
      w.nextId(),
      ApplySpaceMembership({ memberId: person, change: 'joined' })
    );
    await choice(w, person, { operation: 'claim', side });
    await choice(w, person, readyFor(w, side));
  }
}
async function prepare(w: RoomWorld, capability: string): Promise<void> {
  // regression: game-session-decision-private-setup
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
  if (capability === 'create a game session') return;
  const botSetup =
    capability === 'configure a game session bot' ||
    (capability === 'configure a game session' && !isTurnHarnessGame(w.game));
  await choice(w, w.host, {
    operation: 'create',
    mode: botSetup ? 'vs-bot' : 'vs-human',
    game: w.game.shared.id,
  });
  if (capability === 'join a game session' && actor === w.host)
    await choice(w, w.host, { operation: 'release', side: 'white' });
  if (capability === 'start a game session') {
    await choice(w, PEER, { operation: 'claim', side: 'black' });
    await choice(w, PEER, readyFor(w, 'black'));
    await fillExtraSides(w);
    await choice(w, w.host, readyFor(w, 'white'));
    return;
  }
  if (
    capability === 'cancel a game session' &&
    spacePresenceOf(w.c.input) === 'guest'
  ) {
    // A participant cancels only a game between people, before each side moved.
    await choice(w, actor, { operation: 'claim', side: 'black' });
    await fillExtraSides(w);
    await choice(w, actor, readyFor(w, 'black'));
    await choice(w, w.host, readyFor(w, 'white'));
    await choice(w, w.host, { operation: 'start' });
    return;
  }
  if (capability !== 'play a game session') return;
  if (spacePresenceOf(w.c.input) === 'guest') {
    await choice(w, w.host, { operation: 'open', side: 'white' });
    await choice(w, actor, { operation: 'claim', side: 'white' });
  }
  await choice(w, PEER, { operation: 'claim', side: 'black' });
  await fillExtraSides(w);
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
): GameSessionInput | null {
  switch (capability) {
    case 'create a game session':
      return { operation: 'create', mode: 'vs-human', game: game.shared.id };
    case 'configure a game session':
      return isTurnHarnessGame(game)
        ? { operation: 'clock', minutes: 5, increment: 2 }
        : { operation: 'difficulty', side: 'black', difficulty: 'easy' };
    case 'invite a game session participant':
      return { operation: 'invite', side: 'black', person: PEER };
    case 'configure a game session bot':
      return { operation: 'bot', side: 'black' };
    case 'start a game session':
      return { operation: 'start' };
    case 'cancel a game session':
      return { operation: 'cancel' };
    case 'join a game session':
      return { operation: 'claim', side: 'black' };
    case 'play a game session': {
      if (!isTurnHarnessGame(game)) return null;
      const move = game.fixtures.firstSideVictory[0];
      if (move === undefined)
        throw new Error(`${game.label} has no first move`);
      return { operation: 'move', uci: move, ply: 0 };
    }
    case 'watch a game session':
      return null;
    default:
      throw new Error(`no operation for ${capability}`);
  }
}
export async function seedGameSessionDecision(c: ServerCase): Promise<void> {
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
  if (isTurnHarnessGame(game)) await game.shared.turnGame.rules.prepare?.();
  const w = createDecisionRoom(game, c);
  try {
    await decisionConnection(w, w.host).connect();
    const capability = capabilityOf(c.input);
    await prepare(w, capability);
    if (capability === 'play a game session' && isSimulationHarnessGame(game)) {
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
export function performGameSessionDecision(
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
    if (first === undefined) throw new Error('No game offers game sessions');
    for (const other of others)
      if (other.refusal?.message !== first.refusal?.message)
        throw new Error(
          `${first.game.label} answers "${first.refusal?.message ?? 'yes'}" but ${other.game.label} answers "${other.refusal?.message ?? 'yes'}" to ${capabilityOf(c.input)}`
        );
    if (first.refusal !== null) throw first.refusal;
  };
}
