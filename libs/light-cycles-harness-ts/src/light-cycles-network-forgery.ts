import { SubmitSimulationInput } from '@libs/game-session-shared-ts/simulation-messages';
import type { LightCyclesSeat } from '@libs/light-cycles-shared-ts/light-cycles-config';
import {
  ROOM_SERVER_ENDPOINT,
  roomClientEndpoint,
  roomNetKey,
} from '@pkgs/room-root-harness-ts/network';
import { ROOM_WIRE_KIND, WIRE_VERSION } from '@pkgs/room-root-shared-ts/wire';
import {
  FORGED_SEQUENCE_BASE,
  LIGHT_CYCLES_INTRUDER,
  LIGHT_CYCLES_SPECTATOR,
  type LightCyclesWorld,
} from './light-cycles-network-world';
import {
  decodeArena,
  LIGHT_CYCLES_RIDERS,
  LIGHT_CYCLES_TIMING,
} from './light-cycles-quad';

const MAX_AGE_TICKS = 30;

export type ForgeryKind =
  | 'spectator'
  | 'other-seat'
  | 'intruder'
  | 'unauthenticated'
  | 'stale-round'
  | 'stale-basis'
  | 'future-basis'
  | 'stale-epoch'
  | 'retry';

type Forgery = {
  readonly kind: ForgeryKind;
  /** Who sends it, over their own connection. */
  readonly sender: string;
  /** The seat the command claims to steer. */
  readonly seat: LightCyclesSeat;
  readonly epoch?: string;
  readonly round?: number;
  readonly tick?: number;
};

/** A forged command per kind, or null when the arena has no basis for it yet. */
function forgeryOf(
  kind: Exclude<ForgeryKind, 'retry' | 'unauthenticated'>,
  round: number,
  tick: number
): Forgery | null {
  const alice = LIGHT_CYCLES_RIDERS.white;
  switch (kind) {
    case 'spectator':
      return { kind, sender: LIGHT_CYCLES_SPECTATOR, seat: 'white' };
    case 'other-seat':
      return { kind, sender: alice, seat: 'black' };
    case 'intruder':
      return { kind, sender: LIGHT_CYCLES_INTRUDER, seat: 'red' };
    case 'stale-round':
      // A later round's command would become current as that round begins.
      return round > 1
        ? { kind, sender: alice, seat: 'white', round: round - 1 }
        : null;
    case 'stale-basis':
      // Before the arena is older than the age limit, no basis is stale yet.
      return tick > 2 * MAX_AGE_TICKS
        ? {
            kind,
            sender: alice,
            seat: 'white',
            tick: tick - MAX_AGE_TICKS - 10,
          }
        : null;
    case 'future-basis':
      return {
        kind,
        sender: alice,
        seat: 'white',
        tick: tick + LIGHT_CYCLES_TIMING.tickRate,
      };
    case 'stale-epoch':
      return {
        kind,
        sender: alice,
        seat: 'white',
        epoch: 'an-earlier-game:1:0',
      };
  }
}

function submission(
  world: LightCyclesWorld,
  forgery: Forgery,
  latest: {
    readonly epoch: string;
    readonly tick: number;
    readonly round: number;
  }
) {
  const sequence = FORGED_SEQUENCE_BASE + world.forged.length + 1;
  world.forged.push({ kind: forgery.kind, seat: forgery.seat, sequence });
  return SubmitSimulationInput({
    version: 1,
    epoch: forgery.epoch ?? latest.epoch,
    playerId: forgery.seat,
    sequence,
    tick: forgery.tick ?? latest.tick,
    value: { round: forgery.round ?? latest.round, heading: 'up' },
  });
}

/** Alice's device frames a command on a connection the room does not know. */
function sendUnauthenticated(
  world: LightCyclesWorld,
  latest: {
    readonly epoch: string;
    readonly tick: number;
    readonly round: number;
  }
): void {
  const alice = LIGHT_CYCLES_RIDERS.white;
  const connectionId =
    world.retired.findLast((item) => item.identity === alice)?.id ??
    'a-connection-never-opened';
  const payload = submission(
    world,
    { kind: 'unauthenticated', sender: alice, seat: 'white' },
    latest
  );
  world.network.send(
    roomClientEndpoint(alice),
    ROOM_SERVER_ENDPOINT,
    {
      connectionId,
      identity: alice,
      payload: {
        v: WIRE_VERSION,
        kind: ROOM_WIRE_KIND.signal,
        id: `signal:forged-${payload.payload.sequence}`,
        ts: world.session.ports.clock.now(),
        payload,
      },
    },
    { key: roomNetKey(alice, 'toServer') }
  );
}

/** Alice's application sends her last command again, unchanged. */
function retryLastCommand(world: LightCyclesWorld): void {
  const alice = LIGHT_CYCLES_RIDERS.white;
  const last = world.tap.inputs.findLast(
    (item) =>
      item.client === alice && item.input.sequence < FORGED_SEQUENCE_BASE
  );
  if (last === undefined) return;
  world.kit.clients
    .get(alice)
    ?.room()
    ?.sendSignal(SubmitSimulationInput(last.input));
}

export function forgeLightCyclesCommand(
  world: LightCyclesWorld,
  kind: ForgeryKind
): void {
  if (kind === 'retry') {
    retryLastCommand(world);
    return;
  }
  const emission = world.tap.latest();
  const state = emission === null ? null : decodeArena(emission.state);
  if (emission === null || state === null) return;
  const latest = {
    epoch: emission.epoch,
    tick: emission.tick,
    round: state.round,
  };
  if (kind === 'unauthenticated') {
    sendUnauthenticated(world, latest);
    return;
  }
  const forgery = forgeryOf(kind, state.round, emission.tick);
  if (forgery === null) return;
  world.kit.clients
    .get(forgery.sender)
    ?.room()
    ?.sendSignal(submission(world, forgery, latest));
}
