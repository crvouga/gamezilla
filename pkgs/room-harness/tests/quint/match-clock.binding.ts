/**
 * `specs/room/match-clock.qnt` against the example game room: White and
 * Black each on their own phone, the model's seconds as the harness's
 * virtual time, and the model's state read from the room, the match clock
 * and the status each phone shows.
 */

import { bindQuintModel, type Picks } from '@pkgs/quint/registry';
import {
  ClaimOutOfTime,
  Move,
  type Player,
  readMatchStatus,
  readPlayerToMove,
  readTimeLeftSeconds,
  readWinner,
  StartMatch,
} from '@pkgs/room/harness';
import {
  addClient,
  clock,
  dispatch,
  exampleSystem,
  expectInSync,
  type RoomHarness,
  readServer,
} from '@pkgs/room-harness';
import { type RoomTraceWorld, roomFingerprint, traceRoom } from './world';

const PLAYERS = ['white', 'black'] as const satisfies readonly Player[];
const SECOND_MS = 1_000;

function player(picks: Picks, name = 'player'): Player {
  return String(picks[name]) as Player;
}

function seconds(picks: Picks, name: string): number {
  return Number(picks[name]);
}

function matchShown(s: RoomHarness): Map<string, string> {
  return new Map(
    PLAYERS.map((id) => {
      const phone = s.kit.clients.get(id);
      return [id, phone === undefined ? '' : readMatchStatus(phone.snapshot())];
    })
  );
}

bindQuintModel<RoomTraceWorld>({
  model: 'match-clock',
  traces: 16,
  maxSteps: 10,
  actions: {
    init: async (w) => {
      w.patient = false;
      w.harness = await exampleSystem.run({ seed: w.ctx.testId });
      for (const id of PLAYERS) {
        await w.harness.apply(addClient, { id, identity: id });
      }
      await expectInSync(w.harness);
    },
    startMatch: async (w, picks) => {
      await traceRoom(w).apply(dispatch, {
        clientId: player(picks),
        payload: StartMatch({
          whiteMs: seconds(picks, 'white') * SECOND_MS,
          blackMs: seconds(picks, 'black') * SECOND_MS,
        }),
      });
    },
    move: async (w, picks) => {
      await traceRoom(w).apply(dispatch, {
        clientId: player(picks),
        payload: Move({}),
      });
    },
    claimOutOfTime: async (w, picks) => {
      await traceRoom(w).apply(dispatch, {
        clientId: player(picks),
        payload: ClaimOutOfTime({ player: player(picks, 'other') }),
      });
    },
    timePasses: async (w, picks) => {
      await traceRoom(w).advanceTime(seconds(picks, 'seconds') * SECOND_MS);
    },
  },
  observe: async (w) => {
    const s = traceRoom(w);
    const room = await readServer(s);
    const now = await s.read(clock);
    return {
      matchStatus: readMatchStatus(room),
      playerToMove: readPlayerToMove(room),
      timeLeft: new Map(
        PLAYERS.map((id) => [id, readTimeLeftSeconds(room, id, now)])
      ),
      winner: readWinner(room) ?? '',
      matchShown: await s.read(matchShown),
    };
  },
  fingerprint: roomFingerprint,
});
