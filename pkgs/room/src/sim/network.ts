import type { SeededRng } from '@pkgs/io';

/** VOPR-style one-way link knobs for room loopback frames. */
export type RoomFaultProfile = {
  readonly oneWayDelayMeanMs: number;
  readonly oneWayDelayJitterMs: number;
  readonly packetLossProbability: number;
  /** Probability a frame is delivered out of FIFO order (extra delay). */
  readonly reorderProbability?: number;
  /** Probability a frame is delivered twice. */
  readonly duplicateProbability?: number;
};

export const RELIABLE_ROOM_FAULTS: RoomFaultProfile = {
  oneWayDelayMeanMs: 0,
  oneWayDelayJitterMs: 0,
  packetLossProbability: 0,
};

/** Mild fixed delay/loss for deterministic fault scenarios. */
export const MILD_ROOM_FAULTS: RoomFaultProfile = {
  oneWayDelayMeanMs: 5,
  oneWayDelayJitterMs: 5,
  packetLossProbability: 0.02,
};

export type RoomNetLinkState = 'ok' | 'hold' | 'down';

/** Per-direction link override; omit a side to use the shared link state. */
export type RoomNetDirectionalState = {
  readonly toServer?: RoomNetLinkState;
  readonly toClient?: RoomNetLinkState;
};

export type RoomNetSetArg =
  | RoomNetLinkState
  | RoomFaultProfile
  | RoomNetDirectionalState;

export type RoomNetDirection = 'toServer' | 'toClient';

type QueuedFrame = {
  readonly at: number;
  readonly clientKey: string;
  readonly order: number;
  readonly deliver: () => void;
};

export type RoomNetEffect = Disposable & {
  readonly restore: () => void;
};

type LinkSnapshot = {
  readonly shared: RoomNetLinkState;
  readonly toServer: RoomNetLinkState | undefined;
  readonly toClient: RoomNetLinkState | undefined;
};

function sampleDelayMs(faults: RoomFaultProfile, rng: SeededRng): number {
  const mean = faults.oneWayDelayMeanMs;
  const jitter = faults.oneWayDelayJitterMs;
  if (mean === 0 && jitter === 0) return 0;
  const delta = jitter === 0 ? 0 : Math.floor((rng.random() * 2 - 1) * jitter);
  return Math.max(0, mean + delta);
}

function isFaultProfile(v: RoomNetSetArg): v is RoomFaultProfile {
  return typeof v === 'object' && v !== null && 'oneWayDelayMeanMs' in v;
}

function isDirectional(v: RoomNetSetArg): v is RoomNetDirectionalState {
  return (
    typeof v === 'object' &&
    v !== null &&
    !('oneWayDelayMeanMs' in v) &&
    ('toServer' in v || 'toClient' in v)
  );
}

function sortPending(a: QueuedFrame, b: QueuedFrame): number {
  if (a.at !== b.at) return a.at - b.at;
  return a.order - b.order;
}

/**
 * Per-client link mesh for room DST. Frames are delayed / held / dropped
 * before invoking the underlying deliver callback.
 */
export class SimRoomNetwork {
  private readonly link = new Map<string, RoomNetLinkState>();
  private readonly dirToServer = new Map<string, RoomNetLinkState>();
  private readonly dirToClient = new Map<string, RoomNetLinkState>();
  private readonly held = new Map<string, QueuedFrame[]>();
  private readonly nodeFaults = new Map<string, RoomFaultProfile>();
  private pending: QueuedFrame[] = [];
  private defaultFaults: RoomFaultProfile = RELIABLE_ROOM_FAULTS;
  private nextOrder = 0;

  constructor(
    private readonly now: () => number,
    private readonly rng: SeededRng
  ) {}

  setDefaultFaults(faults: RoomFaultProfile): void {
    this.defaultFaults = faults;
  }

  linkState(clientKey: string): RoomNetLinkState {
    return this.link.get(clientKey) ?? 'ok';
  }

  private effectiveLink(
    clientKey: string,
    direction: RoomNetDirection
  ): RoomNetLinkState {
    const dirMap =
      direction === 'toServer' ? this.dirToServer : this.dirToClient;
    return dirMap.get(clientKey) ?? this.linkState(clientKey);
  }

  /** Frames waiting on the time/delay queue (excludes hold buffers). */
  scheduledCount(): number {
    return this.pending.length;
  }

  pendingCount(): number {
    let held = 0;
    for (const q of this.held.values()) held += q.length;
    return this.pending.length + held;
  }

  /**
   * Schedule a frame toward / from `clientKey`. Dropped when link is `down`;
   * buffered when `hold`; otherwise delayed per fault profile.
   */
  enqueue(
    clientKey: string,
    deliver: () => void,
    direction: RoomNetDirection = 'toServer'
  ): void {
    const state = this.effectiveLink(clientKey, direction);
    if (state === 'down') return;
    const order = this.nextOrder++;
    if (state === 'hold') {
      const holdKey = `${clientKey}:${direction}`;
      const q = this.held.get(holdKey) ?? [];
      q.push({ at: 0, clientKey, order, deliver });
      this.held.set(holdKey, q);
      return;
    }
    const faults = this.nodeFaults.get(clientKey) ?? this.defaultFaults;
    if (
      faults.packetLossProbability > 0 &&
      this.rng.bool(faults.packetLossProbability)
    ) {
      return;
    }
    let delay = sampleDelayMs(faults, this.rng);
    const reorderP = faults.reorderProbability ?? 0;
    if (reorderP > 0 && this.rng.bool(reorderP)) {
      delay += 1 + Math.floor(this.rng.random() * 20);
    }
    this.schedule(clientKey, order, delay, deliver);
    const dupP = faults.duplicateProbability ?? 0;
    if (dupP > 0 && this.rng.bool(dupP)) {
      this.schedule(clientKey, this.nextOrder++, delay + 1, deliver);
    }
  }

  private schedule(
    clientKey: string,
    order: number,
    delay: number,
    deliver: () => void
  ): void {
    this.pending.push({
      at: this.now() + delay,
      clientKey,
      order,
      deliver,
    });
    this.pending.sort(sortPending);
  }

  /** Deliver all frames with `at <= now`. Returns count delivered. */
  flushDue(now: number): number {
    let n = 0;
    while (
      this.pending.length > 0 &&
      (this.pending[0]?.at ?? Infinity) <= now
    ) {
      const frame = this.pending.shift();
      if (frame === undefined) break;
      frame.deliver();
      n += 1;
    }
    return n;
  }

  releaseHeld(clientKey: string): void {
    for (const direction of ['toServer', 'toClient'] as const) {
      const holdKey = `${clientKey}:${direction}`;
      const q = this.held.get(holdKey);
      if (q === undefined || q.length === 0) continue;
      this.held.delete(holdKey);
      const now = this.now();
      for (const frame of q) {
        this.pending.push({ ...frame, at: now });
      }
    }
    // Legacy shared hold key (pre-directional).
    const legacy = this.held.get(clientKey);
    if (legacy !== undefined && legacy.length > 0) {
      this.held.delete(clientKey);
      const now = this.now();
      for (const frame of legacy) {
        this.pending.push({ ...frame, at: now });
      }
    }
    this.pending.sort(sortPending);
  }

  releaseAllHeld(): void {
    for (const key of [...this.held.keys()]) {
      const clientKey = key.includes(':') ? key.split(':')[0]! : key;
      this.releaseHeld(clientKey);
    }
  }

  healAll(): void {
    this.releaseAllHeld();
    for (const key of [...this.link.keys()]) {
      this.link.set(key, 'ok');
    }
    this.dirToServer.clear();
    this.dirToClient.clear();
    this.nodeFaults.clear();
    this.defaultFaults = RELIABLE_ROOM_FAULTS;
  }

  private snapshot(clientKey: string): LinkSnapshot {
    return {
      shared: this.linkState(clientKey),
      toServer: this.dirToServer.get(clientKey),
      toClient: this.dirToClient.get(clientKey),
    };
  }

  private applySnapshot(clientKey: string, snap: LinkSnapshot): void {
    this.link.set(clientKey, snap.shared);
    if (snap.toServer === undefined) this.dirToServer.delete(clientKey);
    else this.dirToServer.set(clientKey, snap.toServer);
    if (snap.toClient === undefined) this.dirToClient.delete(clientKey);
    else this.dirToClient.set(clientKey, snap.toClient);
  }

  /**
   * Set link / faults for `clientKey`. Returns a disposable that restores the
   * prior snapshot (sync-engine-style scoped `using`).
   */
  set(clientKey: string, next: RoomNetSetArg): RoomNetEffect {
    const priorLink = this.snapshot(clientKey);
    const priorFaults = this.nodeFaults.get(clientKey);
    if (isFaultProfile(next)) {
      this.nodeFaults.set(clientKey, next);
      this.link.set(clientKey, 'ok');
      this.dirToServer.delete(clientKey);
      this.dirToClient.delete(clientKey);
      this.releaseHeld(clientKey);
    } else if (isDirectional(next)) {
      if (next.toServer !== undefined) {
        this.dirToServer.set(clientKey, next.toServer);
        if (next.toServer === 'down') {
          this.held.delete(`${clientKey}:toServer`);
        }
      }
      if (next.toClient !== undefined) {
        this.dirToClient.set(clientKey, next.toClient);
        if (next.toClient === 'down') {
          this.held.delete(`${clientKey}:toClient`);
        }
      }
    } else if (next === 'ok') {
      this.link.set(clientKey, 'ok');
      this.dirToServer.delete(clientKey);
      this.dirToClient.delete(clientKey);
      this.nodeFaults.delete(clientKey);
      this.releaseHeld(clientKey);
    } else if (next === 'hold') {
      this.link.set(clientKey, 'hold');
    } else {
      this.link.set(clientKey, 'down');
      this.held.delete(clientKey);
      this.held.delete(`${clientKey}:toServer`);
      this.held.delete(`${clientKey}:toClient`);
    }
    let restored = false;
    const restore = (): void => {
      if (restored) return;
      restored = true;
      this.applySnapshot(clientKey, priorLink);
      if (priorFaults === undefined) this.nodeFaults.delete(clientKey);
      else this.nodeFaults.set(clientKey, priorFaults);
      if (priorLink.shared === 'ok' && priorLink.toServer === undefined) {
        this.releaseHeld(clientKey);
      }
    };
    return {
      restore,
      [Symbol.dispose]: restore,
    };
  }
}

export type SimRoomNetHandle = {
  readonly set: (next: RoomNetSetArg) => RoomNetEffect;
};
