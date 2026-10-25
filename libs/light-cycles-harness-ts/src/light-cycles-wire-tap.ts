import {
  type SimulationInputPayload,
  type SimulationSnapshotPayload,
  SimulationStateChanged,
  SubmitSimulationInput,
} from '@libs/game-session-shared-ts/simulation-messages';
import {
  ROOM_SERVER_ENDPOINT,
  type RoomServerIngress,
} from '@pkgs/room-root-harness-ts/network';
import type {
  ClientToServerWire,
  ServerToClientWire,
} from '@pkgs/room-root-shared-ts/wire';

export type WireTally = {
  frames: number;
  bytes: number;
  maxFrameBytes: number;
};
const empty = (): WireTally => ({ frames: 0, bytes: 0, maxFrameBytes: 0 });

/** One authority publication, as the room handed it to the link. */
export type Emission = SimulationSnapshotPayload & {
  readonly atMs: number;
  readonly bytes: number;
  recipients: number;
};

export type SentInput = {
  readonly client: string;
  readonly connectionId: string;
  readonly input: SimulationInputPayload;
  readonly atMs: number;
};

export type Rejection = {
  readonly client: string;
  readonly commandId: string;
  readonly reason: string;
};

export type ConnectionTraffic = { up: WireTally; down: WireTally };

const CLIENT_PREFIX = 'room:client:';

function add(tally: WireTally, bytes: number): void {
  tally.frames += 1;
  tally.bytes += bytes;
  tally.maxFrameBytes = Math.max(tally.maxFrameBytes, bytes);
}

/**
 * Wire observations before faults apply: every authority snapshot, every
 * input a device sends, every refusal, and UTF-8 JSON bytes per connection
 * (the harness routing envelope and framing excluded).
 */
export class LightCyclesWireTap {
  readonly emissions: Emission[] = [];
  readonly inputs: SentInput[] = [];
  readonly rejections: Rejection[] = [];
  /** Full welcomes sent to each device; a resync after a gap sends another. */
  readonly welcomes = new Map<string, number>();
  /** Every connection id each device has sent from. */
  readonly connectionIds = new Map<string, Set<string>>();
  private readonly lastSent = new Map<string, Emission>();
  private readonly byWire = new WeakMap<object, Emission | number>();
  private traffic = new Map<string, ConnectionTraffic>();
  private snapshots = empty();
  private publications = empty();

  constructor(private readonly now: () => number) {}

  record(from: string, to: string, raw: unknown): void {
    const server = from === ROOM_SERVER_ENDPOINT;
    const client = (server ? to : from).slice(CLIENT_PREFIX.length);
    const wire = (server ? raw : (raw as RoomServerIngress).payload) as
      | ClientToServerWire
      | ServerToClientWire;
    const bytes = this.bytesOf(wire);
    const traffic = this.trafficOf(client);
    add(server ? traffic.down : traffic.up, bytes);
    if (server) this.recordDown(client, wire as ServerToClientWire, bytes);
    else
      this.recordUp(
        client,
        raw as RoomServerIngress,
        wire as ClientToServerWire
      );
  }

  private recordDown(
    client: string,
    wire: ServerToClientWire,
    bytes: number
  ): void {
    if (wire.kind === 'welcome')
      this.welcomes.set(client, (this.welcomes.get(client) ?? 0) + 1);
    if (wire.kind === 'rejected') {
      this.rejections.push({
        client,
        commandId: wire.commandId,
        reason:
          'reason' in wire.error ? String(wire.error.reason) : wire.error.type,
      });
      return;
    }
    if (wire.kind !== 'signal' || !SimulationStateChanged.is(wire.payload))
      return;
    add(this.snapshots, bytes);
    const known = this.byWire.get(wire);
    let emission = typeof known === 'object' ? known : undefined;
    if (emission === undefined) {
      emission = {
        ...wire.payload.payload,
        atMs: this.now(),
        bytes,
        recipients: 0,
      };
      this.byWire.set(wire, emission);
      this.emissions.push(emission);
      add(this.publications, bytes);
    }
    emission.recipients += 1;
    this.lastSent.set(client, emission);
  }

  private recordUp(
    client: string,
    ingress: RoomServerIngress,
    wire: ClientToServerWire
  ): void {
    const ids = this.connectionIds.get(client) ?? new Set<string>();
    ids.add(ingress.connectionId);
    this.connectionIds.set(client, ids);
    if (wire.kind !== 'signal' || !SubmitSimulationInput.is(wire.payload))
      return;
    this.inputs.push({
      client,
      connectionId: ingress.connectionId,
      input: wire.payload.payload,
      atMs: this.now(),
    });
  }

  private bytesOf(wire: object): number {
    const known = this.byWire.get(wire);
    if (typeof known === 'number') return known;
    if (known !== undefined) return known.bytes;
    const bytes = new TextEncoder().encode(JSON.stringify(wire)).byteLength;
    this.byWire.set(wire, bytes);
    return bytes;
  }

  private trafficOf(client: string): ConnectionTraffic {
    const known = this.traffic.get(client);
    if (known !== undefined) return known;
    const created = { up: empty(), down: empty() };
    this.traffic.set(client, created);
    return created;
  }

  /** The newest snapshot the room sent this device's connection. */
  lastSentTo(client: string): Emission | null {
    return this.lastSent.get(client) ?? null;
  }

  latest(): Emission | null {
    return this.emissions.at(-1) ?? null;
  }

  /** Per-connection and fan-out tallies since the last reset. */
  read() {
    return {
      connections: Object.fromEntries(
        [...this.traffic]
          .sort(([a], [b]) => (a < b ? -1 : 1))
          .map(([id, traffic]) => [
            id,
            { up: { ...traffic.up }, down: { ...traffic.down } },
          ])
      ),
      snapshots: { ...this.snapshots },
      publications: { ...this.publications },
    };
  }

  /** Restart byte accounting; observed snapshots and inputs are kept. */
  resetTraffic(): void {
    this.traffic = new Map();
    this.snapshots = empty();
    this.publications = empty();
  }
}
