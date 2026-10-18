import {
  puzzleSessionCommand,
  readPuzzleSession,
} from '@libs/game-session-harness/puzzle-session-probe';
import { pollUntil, scenarioAction } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { accountIdOf } from '@libs/harness/identity';
import { readSpaceLink } from '@libs/spaces-harness/spaces-ui-reads';
import { newCommandId } from '@pkgs/room-root-shared/ids';
import type {
  RoomCommandPayload,
  RoomState,
} from '@pkgs/room-root-shared/types';
import {
  parseServerToClientWire,
  ROOM_WIRE_KIND,
  WIRE_VERSION,
} from '@pkgs/room-root-shared/wire';
import { Chess } from 'chess.js';
import type { PuzzleFinish } from './chess-actions';
import { closePuzzleApp } from './puzzle-result-recovery';

function finishCommands(
  state: RoomState,
  finish: PuzzleFinish
): RoomCommandPayload[] {
  if (finish === 'skip') return [puzzleSessionCommand({ kind: 'skip' })];
  if (finish === 'showSolution')
    return [puzzleSessionCommand({ kind: 'show-line' })];
  const session = readPuzzleSession(state);
  const moves = session.line;
  const next = session.solveIdx;
  const prefix: RoomCommandPayload[] = [];
  if (finish === 'hintThenSolve')
    prefix.push(puzzleSessionCommand({ kind: 'hint' }));
  if (finish === 'wrongRetrySolve') {
    const board = new Chess(session.displayPosition!);
    const wrong = board
      .moves({ verbose: true })
      .map((move) => `${move.from}${move.to}${move.promotion ?? ''}`)
      .find((move) => move !== moves[next]);
    if (wrong === undefined) throw new Error('Puzzle has no legal wrong move');
    prefix.push(
      puzzleSessionCommand({ kind: 'move', action: wrong }),
      puzzleSessionCommand({ kind: 'retry' })
    );
  }
  const first = finish === 'wrongRetrySolve' ? 1 : next;
  for (let i = first; i < moves.length; i += 2) {
    const action = moves[i];
    if (action === undefined) throw new Error('Missing solution move');
    prefix.push(puzzleSessionCommand({ kind: 'move', action }));
  }
  return prefix;
}

/** The already-sent finish reaches the room after the solver's app closes. */
export const finishPuzzleAsAppCloses = scenarioAction({
  name: 'finishPuzzleAsAppCloses',
  act: async (s, actor: string, finish: PuzzleFinish) => {
    const link = await readSpaceLink(s, actor);
    const spaceId = link?.slice('/space/'.length);
    const identity = await accountIdOf(s, actor);
    if (!spaceId || !identity)
      throw new Error('Solver has no account or space');
    const state = s.harness.roomNode.inspect(
      `space:${spaceId}`
    )?.committedState;
    if (state === undefined) throw new Error('Space has no committed puzzle');
    const commands = finishCommands(state, finish);
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
      for (const payload of commands) {
        await deliver(s, (wire) => transport.sendJson(wire), frames, payload);
      }
    } finally {
      unsubscribe();
      transport.destroy();
    }
  },
});

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
        if (frame?.kind === ROOM_WIRE_KIND.rejected && frame.commandId === id) {
          throw new Error(
            `Puzzle finish rejected: ${JSON.stringify(frame.error)}`
          );
        }
        if (frame?.kind === ROOM_WIRE_KIND.committed && frame.commandId === id)
          return Promise.resolve(true);
      }
      return Promise.resolve(null);
    },
    {
      maxMs: 15_000,
      stepMs: 100,
      description: 'finish committed after app closure',
    }
  );
}
