import { bindQuintModel } from '@pkgs/quint-shared-ts/registry';
import { expectInSync } from '@pkgs/room-root-harness-ts/expect-in-sync';
import type { Player } from '@pkgs/room-root-harness-ts/game-room';
import {
  Move,
  readClocksPaused,
  readMatchStatus,
  readPlayerToMove,
  readTimeLeftSeconds,
  readWinner,
  StartMatch,
} from '@pkgs/room-root-harness-ts/game-room';
import { clock, serverCrashed } from '@pkgs/room-root-harness-ts/observations';
import { readServer } from '@pkgs/room-root-harness-ts/read-state';
import {
  addClient,
  connect,
  disconnect,
  dispatch,
  resumeNetwork,
  serverCrash,
  serverRestart,
} from '@pkgs/room-root-harness-ts/room-actions';
import { exampleSystem } from '@pkgs/room-root-harness-ts/system';
import { interruptedMatchChoice } from '../interrupted-match';
import type { RoomTraceWorld } from './world';
import { roomFingerprint, traceRoom } from './world';

const PLAYERS = ['white', 'black'] as const;
const apart = new WeakMap<RoomTraceWorld, Set<string>>();
const start = () => StartMatch({ whiteMs: 4000, blackMs: 4000 });

bindQuintModel<RoomTraceWorld>({
  model: 'match-recovery',
  traces: 128,
  maxSteps: 48,
  actions: {
    init: async (w) => {
      w.patient = false;
      w.harness = await exampleSystem.run({ seed: w.ctx.testId });
      apart.set(w, new Set());
      for (const person of PLAYERS)
        await traceRoom(w).apply(addClient, { id: person, identity: person });
      await expectInSync(traceRoom(w));
    },
    startMatch: (w, picks) =>
      traceRoom(w).apply(dispatch, {
        clientId: String(picks['player']),
        payload: start(),
      }),
    move: (w, picks) =>
      traceRoom(w).apply(dispatch, {
        clientId: String(picks['player']),
        payload: Move({}),
      }),
    _roomStopsAsMatchStarts: (w) =>
      interruptedMatchChoice(traceRoom(w), 'white', start()),
    _roomStopsAsMoveCounts: (w, picks) =>
      interruptedMatchChoice(traceRoom(w), String(picks['player']), Move({})),
    timePasses: (w) => traceRoom(w).advanceTime(1000),
    _wait: (w) => traceRoom(w).advanceTime(0),
    _roomStops: (w) => traceRoom(w).apply(serverCrash),
    _roomReturns: async (w) => {
      const s = traceRoom(w);
      await s.apply(serverRestart);
      for (const person of PLAYERS) {
        if (apart.get(w)!.has(person)) await s.apply(disconnect, person);
        else await s.apply(resumeNetwork, person);
      }
      await s.advanceTime(0);
    },
    _loseConnection: async (w, picks) => {
      const person = String(picks['player']);
      apart.get(w)!.add(person);
      await traceRoom(w).apply(disconnect, person);
    },
    _connectionReturns: async (w, picks) => {
      const person = String(picks['player']);
      apart.get(w)!.delete(person);
      if (!(await traceRoom(w).read(serverCrashed))) {
        await traceRoom(w).apply(resumeNetwork, person);
        await traceRoom(w).apply(connect, person);
      }
    },
  },
  observe: async (w) => {
    const s = traceRoom(w);
    const state = await readServer(s);
    const now = await s.read(clock);
    return {
      clocksPaused: readClocksPaused(state),
      matchStatus: readMatchStatus(state),
      playerToMove: readPlayerToMove(state),
      winner: readWinner(state) ?? '',
      timeLeft: new Map(
        PLAYERS.map((person) => [
          person,
          readTimeLeftSeconds(state, person as Player, now),
        ])
      ),
      _available: !(await s.read(serverCrashed)),
    };
  },
  fingerprint: roomFingerprint,
});
