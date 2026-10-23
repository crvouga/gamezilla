/**
 * Finishing a puzzle of any game offering puzzles, every way a solver can:
 * on the board as a person does (a clean solve, a hint then a solve, a
 * wrong move retried then solved, the shown solution, a skip), as the app
 * closes (the finish already sent reaches the room after the app is gone),
 * on two devices of one account acting apart, won another way on each, and
 * day after day. Every move is the game's known puzzle's.
 */

import { partition, restoreActorConnection } from '@libs/harness-ts/actions';
import { pollUntil, scenarioAction } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { accountIdOf } from '@libs/harness-ts/identity';
import type { PuzzleFinishName } from '@libs/harness-ts/parameter-types';
import { focusActor } from '@libs/harness-ts/shell-actions';
import { reopenSpaceLink } from '@libs/spaces-harness-ts/space-actions';
import { readSpaceLink } from '@libs/spaces-harness-ts/spaces-ui-reads';
import { newCommandId } from '@pkgs/room-root-shared-ts/ids';
import type {
  RoomCommandPayload,
  RoomState,
} from '@pkgs/room-root-shared-ts/types';
import {
  parseServerToClientWire,
  ROOM_WIRE_KIND,
  WIRE_VERSION,
} from '@pkgs/room-root-shared-ts/wire';
import { puzzleLineLayout } from '@pkgs/turn-game-shared-ts/game-puzzles';
import { harnessGameOf } from './harness-game-of';
import { sleepUntilNextUtcDay } from './puzzle-allowance';
import {
  knownPuzzle,
  playWrongMoveHere,
  solveKnownPuzzle,
  winKnownPuzzleAnotherWay,
  wrongMoveAt,
} from './puzzle-moves';
import {
  closePuzzleApp,
  readLocalPuzzleResult,
  readRecordedPuzzleResult,
} from './puzzle-result-recovery';
import {
  moveOnToNextPuzzle,
  readPuzzleOnBoard,
  readPuzzleProbe,
  retryGamePuzzle,
  showPuzzleSolution,
  skipGamePuzzle,
  takePuzzleHint,
  waitSolverMayMove,
} from './puzzle-screen';
import {
  puzzleSessionCommand,
  readPuzzleSession,
} from './puzzle-session-probe';

const WAIT_MS = 15_000;
const SETTLE_MS = 20_000;
const COUNTED_MS = 30_000;

/** Finish the puzzle on the board the way `finish` names, as a person does. */
export const finishGamePuzzleBy = scenarioAction({
  name: 'finishGamePuzzleBy',
  act: async (s, actorId: string, gameId: string, finish: PuzzleFinishName) => {
    if (finish === 'hintThenSolve')
      await Promise.resolve(takePuzzleHint.act(s, actorId));
    if (finish === 'wrongRetrySolve') {
      await Promise.resolve(playWrongMoveHere.act(s, actorId, gameId));
      await Promise.resolve(retryGamePuzzle.act(s, actorId));
      await waitSolverMayMove(s, actorId);
    }
    if (finish === 'showSolution')
      await Promise.resolve(showPuzzleSolution.act(s, actorId));
    else if (finish === 'skip')
      await Promise.resolve(skipGamePuzzle.act(s, actorId));
    else await Promise.resolve(solveKnownPuzzle.act(s, actorId, gameId));
  },
});

/** The session commands a solver's app sends to finish the way `finish` names. */
function finishCommands(
  s: ProductHarness,
  on: {
    readonly gameId: string;
    readonly puzzleId: string;
    readonly state: RoomState;
  },
  finish: PuzzleFinishName
): RoomCommandPayload[] {
  const { gameId, puzzleId, state } = on;
  if (finish === 'skip') return [puzzleSessionCommand({ kind: 'skip' })];
  if (finish === 'showSolution')
    return [puzzleSessionCommand({ kind: 'show-line' })];
  const game = harnessGameOf(s, gameId);
  const fixture = knownPuzzle(game, puzzleId);
  const puzzles = game.shared.turnGame.capabilities.puzzles;
  if (puzzles === undefined) throw new Error(`${game.label} offers no puzzles`);
  const layout = puzzleLineLayout(puzzles);
  const { line, solveIdx } = readPuzzleSession(state);
  const commands: RoomCommandPayload[] = [];
  if (finish === 'hintThenSolve')
    commands.push(puzzleSessionCommand({ kind: 'hint' }));
  if (finish === 'wrongRetrySolve')
    commands.push(
      puzzleSessionCommand({
        kind: 'move',
        action: wrongMoveAt(game, fixture, solveIdx),
      }),
      puzzleSessionCommand({ kind: 'retry' })
    );
  for (let index = solveIdx; index < line.length; index += layout.solverStep) {
    const action = line[index];
    if (action === undefined)
      throw new Error(`${puzzleId} has no move ${index}`);
    commands.push(puzzleSessionCommand({ kind: 'move', action }));
  }
  return commands;
}

async function deliver(
  s: ProductHarness,
  send: (wire: unknown) => void,
  frames: readonly unknown[],
  payload: RoomCommandPayload
): Promise<void> {
  const id = newCommandId(s.harness.server.createId);
  send({
    v: WIRE_VERSION,
    kind: ROOM_WIRE_KIND.command,
    id,
    ts: s.harness.clock.now(),
    payload,
  });
  await pollUntil(
    s,
    () => {
      for (const raw of frames) {
        const frame = parseServerToClientWire(raw);
        if (frame?.kind === ROOM_WIRE_KIND.rejected && frame.commandId === id)
          throw new Error(
            `Puzzle finish rejected: ${JSON.stringify(frame.error)}`
          );
        if (frame?.kind === ROOM_WIRE_KIND.committed && frame.commandId === id)
          return Promise.resolve(true);
      }
      return Promise.resolve(null);
    },
    {
      maxMs: WAIT_MS,
      stepMs: 100,
      description: 'the finish committed after the app closed',
    }
  );
}

/**
 * The solver's finish, already on its way, reaches the room after their
 * app has closed: the commands go out on the connection the app had, and
 * the app is gone before the result comes back.
 */
export const finishGamePuzzleAsAppCloses = scenarioAction({
  name: 'finishGamePuzzleAsAppCloses',
  act: async (s, actor: string, gameId: string, finish: PuzzleFinishName) => {
    const link = await readSpaceLink(s, actor);
    const spaceId = link?.slice('/space/'.length);
    const identity = await accountIdOf(s, actor);
    const puzzleId = await readPuzzleOnBoard(s, actor);
    if (!spaceId || !identity || puzzleId === null)
      throw new Error(`${actor} has no account, space or puzzle`);
    const state = s.harness.roomNode.inspect(
      `space:${spaceId}`
    )?.committedState;
    if (state === undefined) throw new Error('The space has no puzzle');
    const commands = finishCommands(s, { gameId, puzzleId, state }, finish);
    const env = await s.harness.client(actor);
    const frames: unknown[] = [];
    const transport = s.harness.roomNode.createTransport({
      topic: `space:${spaceId}`,
      module: 'space',
      apiUrl: '',
      identity,
      installId: `${actor}-finish`,
      clientId: `${actor}-finish`,
      getSessionToken: () => null,
      timers: env.timers,
      random: env.random,
    });
    const unsubscribe = transport.subscribe((raw) => {
      frames.push(typeof raw === 'string' ? JSON.parse(raw) : raw);
    });
    try {
      await transport.connect();
      await Promise.resolve(closePuzzleApp.act(s, actor));
      for (const payload of commands)
        await deliver(s, (wire) => transport.sendJson(wire), frames, payload);
    } finally {
      unsubscribe();
      transport.destroy();
    }
  },
});

/**
 * `other` (another device of `actor`'s account) opens the space `actor`'s
 * account hosts and has the same puzzle on its board; then both lose the
 * connection, each with its own copy. The puzzle.
 */
async function copiesApart(
  s: ProductHarness,
  actor: string,
  other: string
): Promise<string> {
  await Promise.resolve(focusActor.act(s, actor));
  const link = await readSpaceLink(s, actor);
  const puzzle = await readPuzzleOnBoard(s, actor);
  if (link === null || puzzle === null)
    throw new Error(`${actor} has no puzzle in a space`);
  await Promise.resolve(reopenSpaceLink.act(s, other, link));
  await pollUntil(
    s,
    async () =>
      (await readPuzzleOnBoard(s, other)) === puzzle &&
      (await readPuzzleProbe(s, other))?.interactive === true
        ? true
        : null,
    {
      maxMs: SETTLE_MS,
      description: 'the other device has the same playable puzzle',
    }
  );
  await Promise.resolve(partition.act(s, actor));
  await Promise.resolve(partition.act(s, other));
  return puzzle;
}

/**
 * Two devices of one account finish the same puzzle apart, `first` on
 * `actor`'s and `second` on `other`'s; `actor`'s comes back first and its
 * result is counted, and with `reconnectOther` the other comes back after
 * and receives it.
 */
export const finishGamePuzzleOnTwoDevices = scenarioAction({
  name: 'finishGamePuzzleOnTwoDevices',
  act: async (
    s,
    args: {
      readonly actor: string;
      readonly other: string;
      readonly gameId: string;
      readonly first: PuzzleFinishName;
      readonly second: PuzzleFinishName;
      readonly reconnectOther: boolean;
    }
  ) => {
    const { actor, other, gameId } = args;
    const puzzle = await copiesApart(s, actor, other);
    await Promise.resolve(focusActor.act(s, actor));
    await Promise.resolve(finishGamePuzzleBy.act(s, actor, gameId, args.first));
    await Promise.resolve(focusActor.act(s, other));
    await Promise.resolve(
      finishGamePuzzleBy.act(s, other, gameId, args.second)
    );
    await Promise.resolve(restoreActorConnection.act(s, actor));
    await pollUntil(
      s,
      async () =>
        (await readRecordedPuzzleResult(s, actor, puzzle)) !== 'Unfinished'
          ? true
          : null,
      { maxMs: COUNTED_MS, description: "the first device's result counted" }
    );
    if (!args.reconnectOther) return;
    await Promise.resolve(restoreActorConnection.act(s, other));
    const first = await readRecordedPuzzleResult(s, actor, puzzle);
    await Promise.resolve(focusActor.act(s, other));
    await pollUntil(
      s,
      async () =>
        (await readLocalPuzzleResult(s, other, puzzle)) === first ? true : null,
      {
        maxMs: COUNTED_MS,
        description: 'the returning device received the first result',
      }
    );
  },
});

/**
 * Two devices of one account win the same puzzle apart, each its own way:
 * `actor`'s off the line, `other`'s along it.
 */
export const winGamePuzzleApartBothWays = scenarioAction({
  name: 'winGamePuzzleApartBothWays',
  act: async (s, actor: string, other: string, gameId: string) => {
    await copiesApart(s, actor, other);
    await Promise.resolve(focusActor.act(s, actor));
    await Promise.resolve(winKnownPuzzleAnotherWay.act(s, actor, gameId));
    await pollUntil(
      s,
      async () =>
        (await readPuzzleProbe(s, actor))?.status === 'solved' ? true : null,
      { maxMs: WAIT_MS, description: 'the puzzle won another way' }
    );
    await Promise.resolve(focusActor.act(s, other));
    await Promise.resolve(solveKnownPuzzle.act(s, other, gameId));
  },
});

/**
 * `perDay` puzzles solved one after another on each of `days` days, moving
 * on after each, the night between days slept through.
 */
export const solveGamePuzzlesDaily = scenarioAction({
  name: 'solveGamePuzzlesDaily',
  act: async (
    s,
    actorId: string,
    gameId: string,
    { perDay, days }: { readonly perDay: number; readonly days: number }
  ) => {
    for (let day = 0; day < days; day += 1) {
      if (day > 0) await Promise.resolve(sleepUntilNextUtcDay.act(s));
      for (let solved = 0; solved < perDay; solved += 1) {
        if (day > 0 || solved > 0)
          await Promise.resolve(moveOnToNextPuzzle.act(s, actorId));
        await Promise.resolve(solveKnownPuzzle.act(s, actorId, gameId));
      }
    }
  },
});

export const PUZZLE_FINISH_ACTIONS = [
  finishGamePuzzleBy,
  finishGamePuzzleAsAppCloses,
  finishGamePuzzleOnTwoDevices,
  winGamePuzzleApartBothWays,
  solveGamePuzzlesDaily,
];
