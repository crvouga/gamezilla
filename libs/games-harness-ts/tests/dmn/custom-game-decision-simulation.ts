import type { SimulationHarnessGame } from '@libs/game-session-harness-ts/harness-game';
import {
  RequestSimulationSnapshot,
  type SimulationSnapshotPayload,
  SimulationStateChanged,
  SubmitSimulationInput,
} from '@libs/game-session-shared-ts/simulation-messages';
import { ClaimSimulationControl } from '@libs/game-session-shared-ts/simulation-steering';
import type { HarnessRoomNode } from '@libs/harness-ts/composition';
import { OperationRefused } from '@libs/permissions-shared-ts/server';
import type { HarnessClockBundle } from '@pkgs/clock-shared-ts/harness-clock';
import {
  isMessageEnvelope,
  type Message,
} from '@pkgs/message-shared-ts/message';
import type { ClientTransport } from '@pkgs/room-root-shared-ts/transport';
import { ROOM_WIRE_KIND, WIRE_VERSION } from '@pkgs/room-root-shared-ts/wire';

type Frame = {
  readonly commandId?: string;
  readonly kind?: string;
  readonly error?: { readonly type: string };
  readonly payload?: unknown;
};
type Context = HarnessClockBundle & {
  readonly game: SimulationHarnessGame;
  readonly node: HarnessRoomNode;
  readonly topic: string;
  readonly nextId: () => string;
  readonly actor: string;
  readonly actorDevice: string;
  readonly host: string;
  readonly peer: string;
};
type Connection = {
  readonly transport: ClientTransport;
  readonly frames: Frame[];
};

function connection(w: Context, identity: string): Connection {
  const transport = w.node.createTransport({
    topic: w.topic,
    module: 'space',
    identity,
    installId: identity === w.actor ? w.actorDevice : `${identity}-device`,
    clientId: w.nextId(),
    apiUrl: '',
    clock: w.clock,
    timers: w.timers,
    random: () => 0.5,
    getSessionToken: () => null,
  });
  const frames: Frame[] = [];
  transport.subscribe((raw) =>
    frames.push((typeof raw === 'string' ? JSON.parse(raw) : raw) as Frame)
  );
  return { transport, frames };
}

function signal(w: Context, from: Connection, payload: Message): string {
  const id = w.nextId();
  from.transport.sendJson({
    v: WIRE_VERSION,
    kind: ROOM_WIRE_KIND.signal,
    id,
    ts: w.clock.now(),
    payload,
  });
  return id;
}

async function settle(w: Context): Promise<void> {
  // Live presence may commit its new input fence after the connection's welcome.
  for (let turn = 0; turn < 4; turn++) await w.node.services.read(w.topic);
}

async function snapshot(
  w: Context,
  from: Connection
): Promise<SimulationSnapshotPayload> {
  const before = from.frames.length;
  signal(w, from, RequestSimulationSnapshot({ version: 1 }));
  await settle(w);
  for (const frame of from.frames.slice(before).reverse())
    if (
      isMessageEnvelope(frame.payload) &&
      SimulationStateChanged.is(frame.payload)
    )
      return frame.payload.payload;
  throw new Error(
    `${w.game.label}: the live room supplied no simulation snapshot`
  );
}

async function submit(
  w: Context,
  owner: Connection,
  actor: Connection
): Promise<void> {
  // One device steers a person's seats; the probe's device claims it, as
  // "Ride from this device" does, before its control is judged.
  signal(w, actor, ClaimSimulationControl({ version: 1 }));
  await settle(w);
  const before = await snapshot(w, owner);
  const example = w.game.simulationFixtures.examples.flatMap(
    (item) => item.inputs
  )[0];
  if (example === undefined)
    throw new Error(`${w.game.label}: no independently authored player input`);
  const id = signal(
    w,
    actor,
    SubmitSimulationInput({
      version: 1,
      epoch: before.epoch,
      playerId: 'white',
      sequence: 1,
      tick: before.tick + 1,
      value: example.value,
    })
  );
  await settle(w);
  const refusal = actor.frames.find(
    (frame) => frame.commandId === id && frame.kind === ROOM_WIRE_KIND.rejected
  );
  if (refusal?.error !== undefined)
    throw new OperationRefused(refusal.error.type);
  const timing = w.game.shared.registration.simulation!.timing;
  w.clock.advance(1000 / timing.tickRate + 0.001);
  await settle(w);
  const after = await snapshot(w, owner);
  if (after.acknowledged['white'] !== 1 || after.tick <= before.tick)
    throw new Error(
      `${w.game.label}: the live authority did not process the player's control`
    );
}

/** Exercise the real typed signal path, including admission, grants and the live input fence. */
export async function performSimulationControlDecision(
  w: Context
): Promise<void> {
  const owner = connection(w, w.host);
  const peer = connection(w, w.peer);
  const actor = w.actor === w.host ? owner : connection(w, w.actor);
  try {
    await owner.transport.connect();
    await peer.transport.connect();
    if (actor !== owner) await actor.transport.connect();
    await settle(w);
    await submit(w, owner, actor);
  } catch (cause) {
    if (cause instanceof Error && cause.message === 'not in the space')
      throw new OperationRefused(cause.message);
    throw cause;
  } finally {
    owner.transport.destroy();
    peer.transport.destroy();
    if (actor !== owner) actor.transport.destroy();
  }
}
