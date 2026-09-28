/**
 * `specs/rooms/match-clock.qnt` against the match-clock room: White and Black each on
 * their own device, the clock pinned to a small epoch, the model's state read
 * from the room and the status each device shows.
 */

import { bindQuintModel, type Picks } from '@pkgs/quint/registry';
import type { RoomState } from '@pkgs/room';
import {
  addClient,
  dispatch,
  expectInSync,
  FlagFall,
  Move,
  matchClockBlackMs,
  matchClockStatus,
  matchClockSystem,
  matchClockTurn,
  matchClockWhiteMs,
  matchClockWinner,
  type RoomHarness,
  readServer,
  roomEpoch,
  StartMatch,
} from '@pkgs/room-harness';
import { type RoomTraceWorld, roomFingerprint, traceRoom } from './world';

const SIDES = ['white', 'black'] as const;
type Side = (typeof SIDES)[number];

function side(picks: Picks, name = 'seat'): Side {
  return String(picks[name]) as Side;
}

function whole(picks: Picks, name: string): number {
  return Number(picks[name]);
}

function matchShown(s: RoomHarness): Map<string, string> {
  return new Map(
    SIDES.map((id) => [
      id,
      matchClockStatus(s.kit.clients.get(id)?.snapshot() as RoomState),
    ])
  );
}

bindQuintModel<RoomTraceWorld>({
  model: 'match-clock',
  traces: 16,
  maxSteps: 10,
  actions: {
    init: async (w) => {
      w.patient = false;
      w.harness = await matchClockSystem.run({
        seed: w.ctx.testId,
        runtime: roomEpoch(10_000),
      });
      for (const id of SIDES) {
        await w.harness.apply(addClient, { id, identity: id });
      }
      await expectInSync(w.harness);
    },
    startMatch: async (w, picks) => {
      await traceRoom(w).apply(dispatch, {
        clientId: side(picks),
        payload: StartMatch({
          whiteMs: whole(picks, 'white'),
          blackMs: whole(picks, 'black'),
        }),
      });
    },
    move: async (w, picks) => {
      await traceRoom(w).apply(dispatch, {
        clientId: side(picks),
        payload: Move({}),
      });
    },
    claimFlag: async (w, picks) => {
      await traceRoom(w).apply(dispatch, {
        clientId: side(picks),
        payload: FlagFall({ seat: side(picks, 'flagged') }),
      });
    },
    clockRuns: async (w, picks) => {
      await traceRoom(w).advanceTime(whole(picks, 'ms'));
    },
  },
  observe: async (w) => {
    const s = traceRoom(w);
    const server = await readServer(s);
    return {
      matchStatus: matchClockStatus(server),
      sideToMove: matchClockTurn(server),
      whiteBank: matchClockWhiteMs(server),
      blackBank: matchClockBlackMs(server),
      winner: matchClockWinner(server) ?? '',
      matchShown: await s.read(matchShown),
    };
  },
  fingerprint: roomFingerprint,
});
