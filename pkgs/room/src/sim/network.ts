import type { SeededRng } from '@pkgs/io';

/** VOPR-style one-way link knobs for room loopback frames. */
export type RoomFaultProfile = {
  readonly oneWayDelayMeanMs: number;
  readonly oneWayDelayJitterMs: number;
  readonly packetLossProbability: number;
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

export type RoomNetSetArg = RoomNetLinkState | RoomFaultProfile;

type QueuedFrame = {
  readonly at: number;
  readonly clientKey: string;
  readonly order: number;
  readonly deliver: () => void;
};

export type RoomNetEffect = Disposable & {
  readonly restore: () => void;
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
  enqueue(clientKey: string, deliver: () => void): void {
    const state = this.linkState(clientKey);
    if (state === 'down') return;
    const order = this.nextOrder++;
    if (state === 'hold') {
      const q = this.held.get(clientKey) ?? [];
      q.push({ at: 0, clientKey, order, deliver });
      this.held.set(clientKey, q);
      return;
    }
    const faults = this.nodeFaults.get(clientKey) ?? this.defaultFaults;
    if (
      faults.packetLossProbability > 0 &&
      this.rng.bool(faults.packetLossProbability)
    ) {
      return;
    }
    const delay = sampleDelayMs(faults, this.rng);
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
    const q = this.held.get(clientKey);
    if (q === undefined || q.length === 0) return;
    this.held.delete(clientKey);
    const now = this.now();
    for (const frame of q) {
      this.pending.push({ ...frame, at: now });
    }
    this.pending.sort(sortPending);
  }

  releaseAllHeld(): void {
    for (const key of [...this.held.keys()]) {
      this.releaseHeld(key);
    }
  }

  healAll(): void {
    this.releaseAllHeld();
    for (const key of [...this.link.keys()]) {
      this.link.set(key, 'ok');
    }
    this.nodeFaults.clear();
    this.defaultFaults = RELIABLE_ROOM_FAULTS;
  }

  /**
   * Set link / faults for `clientKey`. Returns a disposable that restores the
   * prior snapshot (sync-engine-style scoped `using`).
   */
  set(clientKey: string, next: RoomNetSetArg): RoomNetEffect {
    const priorLink = this.linkState(clientKey);
    const priorFaults = this.nodeFaults.get(clientKey);
    if (isFaultProfile(next)) {
      this.nodeFaults.set(clientKey, next);
      this.link.set(clientKey, 'ok');
      this.releaseHeld(clientKey);
    } else if (next === 'ok') {
      this.link.set(clientKey, 'ok');
      this.nodeFaults.delete(clientKey);
      this.releaseHeld(clientKey);
    } else if (next === 'hold') {
      this.link.set(clientKey, 'hold');
    } else {
      this.link.set(clientKey, 'down');
      this.held.delete(clientKey);
    }
    let restored = false;
    const restore = (): void => {
      if (restored) return;
      restored = true;
      this.link.set(clientKey, priorLink);
      if (priorFaults === undefined) this.nodeFaults.delete(clientKey);
      else this.nodeFaults.set(clientKey, priorFaults);
      if (priorLink === 'ok') {
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
