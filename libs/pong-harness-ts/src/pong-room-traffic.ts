import {
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

type Tally = { frames: number; bytes: number; maxFrameBytes: number };
const empty = (): Tally => ({ frames: 0, bytes: 0, maxFrameBytes: 0 });

/** UTF8 JSON wire bytes, excluding the harness routing wrapper and network framing. */
export class PongRoomTraffic {
  private uplink = empty();
  private downlink = empty();
  private snapshots = empty();
  private snapshotPublications = empty();
  private inputs = empty();
  private encoded = new WeakMap<object, number>();

  record(from: string, raw: unknown): void {
    const server = from === ROOM_SERVER_ENDPOINT;
    const wire = (server ? raw : (raw as RoomServerIngress).payload) as
      | ClientToServerWire
      | ServerToClientWire;
    let bytes = this.encoded.get(wire);
    const firstDelivery = bytes === undefined;
    if (bytes === undefined) {
      bytes = new TextEncoder().encode(JSON.stringify(wire)).byteLength;
      this.encoded.set(wire, bytes);
    }
    this.add(server ? this.downlink : this.uplink, bytes);
    if (wire.kind !== 'signal') return;
    if (server && SimulationStateChanged.is(wire.payload)) {
      this.add(this.snapshots, bytes);
      if (firstDelivery) this.add(this.snapshotPublications, bytes);
    }
    if (!server && SubmitSimulationInput.is(wire.payload))
      this.add(this.inputs, bytes);
  }

  reset(): void {
    this.uplink = empty();
    this.downlink = empty();
    this.snapshots = empty();
    this.snapshotPublications = empty();
    this.inputs = empty();
    this.encoded = new WeakMap();
  }

  read() {
    return {
      uplink: { ...this.uplink },
      downlink: { ...this.downlink },
      snapshots: { ...this.snapshots },
      snapshotPublications: { ...this.snapshotPublications },
      inputs: { ...this.inputs },
    };
  }

  private add(tally: Tally, bytes: number): void {
    tally.frames++;
    tally.bytes += bytes;
    tally.maxFrameBytes = Math.max(tally.maxFrameBytes, bytes);
  }
}
