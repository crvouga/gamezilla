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
  type RoomSim,
  readServer,
  roomEpoch,
  StartMatch,
} from '@pkgs/room-sim';
import { type RoomTraceWorld, traceRoom } from './world';

const SEATS = ['white', 'black'] as const;
type Seat = (typeof SEATS)[number];

function seat(picks: Picks, name = 'seat'): Seat {
  return String(picks[name]) as Seat;
}

function whole(picks: Picks, name: string): number {
  return Number(picks[name]);
}

function seen(s: RoomSim): Map<string, string> {
  return new Map(
    SEATS.map((id) => [
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
      w.sim = await matchClockSystem.run({
        seed: w.ctx.testId,
        runtime: roomEpoch(10_000),
      });
      for (const id of SEATS) {
        await w.sim.apply(addClient, { id, identity: id });
      }
      await expectInSync(w.sim);
    },
    start: async (w, picks) => {
      await traceRoom(w).apply(dispatch, {
        clientId: seat(picks),
        payload: StartMatch({
          whiteMs: whole(picks, 'white'),
          blackMs: whole(picks, 'black'),
        }),
      });
    },
    move: async (w, picks) => {
      await traceRoom(w).apply(dispatch, {
        clientId: seat(picks),
        payload: Move({}),
      });
    },
    claimFlag: async (w, picks) => {
      await traceRoom(w).apply(dispatch, {
        clientId: seat(picks),
        payload: FlagFall({ seat: seat(picks, 'flagged') }),
      });
    },
    wait: async (w, picks) => {
      await traceRoom(w).advanceTime(whole(picks, 'ms'));
    },
  },
  observe: async (w) => {
    const s = traceRoom(w);
    const server = await readServer(s);
    return {
      status: matchClockStatus(server),
      turn: matchClockTurn(server),
      whiteMs: matchClockWhiteMs(server),
      blackMs: matchClockBlackMs(server),
      winner: matchClockWinner(server) ?? '',
      seen: await s.read(seen),
    };
  },
});
