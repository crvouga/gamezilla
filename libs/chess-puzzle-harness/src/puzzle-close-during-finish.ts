import { pollUntil, scenarioAction } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { accountIdOf } from '@libs/harness/identity';
import { readSpaceLink } from '@libs/spaces-harness/spaces-ui-reads';
import { newCommandId } from '@pkgs/room-shared/ids';
import { parseServerToClientWire, ROOM_WIRE_KIND, WIRE_VERSION } from '@pkgs/room-shared/wire';
import type { RoomCommandPayload, RoomState } from '@pkgs/room-shared/types';
import { Chess } from 'chess.js';
import { ChessPuzzlePlayAttr } from '@libs/chess-puzzle-shared/chess-puzzle-play-attr';
import { RequestChessPuzzleHint, ResetChessPuzzlePlay, ShowChessPuzzleSolution, SkipChessPuzzlePlay, SubmitChessPuzzleMove } from '@libs/chess-puzzle-shared/chess-puzzle-play-messages';
import type { PuzzleFinish } from './chess-actions';
import { closePuzzleApp } from './puzzle-result-recovery';

function finishCommands(
  state: RoomState,
  finish: PuzzleFinish
): RoomCommandPayload[] {
  if (finish === 'skip') return [SkipChessPuzzlePlay({})];
  if (finish === 'showSolution') return [ShowChessPuzzleSolution({})];
  const moves = ChessPuzzlePlayAttr.moves.from(state).split(' ');
  const next = ChessPuzzlePlayAttr.solveIdx.from(state);
  const prefix: RoomCommandPayload[] = [];
  if (finish === 'hintThenSolve') prefix.push(RequestChessPuzzleHint({}));
  if (finish === 'wrongRetrySolve') {
    const board = new Chess(ChessPuzzlePlayAttr.displayFen.from(state)!);
    const wrong = board
      .moves({ verbose: true })
      .map((move) => `${move.from}${move.to}${move.promotion ?? ''}`)
      .find((move) => move !== moves[next]);
    if (wrong === undefined) throw new Error('Puzzle has no legal wrong move');
    prefix.push(
      SubmitChessPuzzleMove({ uci: wrong }),
      ResetChessPuzzlePlay({})
    );
  }
  const first = finish === 'wrongRetrySolve' ? 1 : next;
  for (let i = first; i < moves.length; i += 2) {
    const uci = moves[i];
    if (uci === undefined) throw new Error('Missing solution move');
    prefix.push(SubmitChessPuzzleMove({ uci }));
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
      spaceId,
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
