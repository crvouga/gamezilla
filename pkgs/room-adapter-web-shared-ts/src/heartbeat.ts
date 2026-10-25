import type { Clock, Timers } from '@pkgs/clock-shared-ts/types';

import { ROOM_WIRE_KIND, WIRE_VERSION } from '@pkgs/room-root-shared-ts/wire';

export type HeartbeatState = {
  interval: unknown | null;
  timeout: unknown | null;
  sentAt: number | null;
};

export function clearHeartbeat(handles: HeartbeatState, timers: Timers): void {
  handles.sentAt = null;
  if (handles.interval !== null) {
    timers.clearInterval(handles.interval);
    handles.interval = null;
  }
  if (handles.timeout !== null) {
    timers.clearTimeout(handles.timeout);
    handles.timeout = null;
  }
}

/**
 * Returns true when `raw` is a wire `pong` frame (liveness reply).
 */
export function isPongWire(raw: unknown): boolean {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return false;
  }
  const r = raw as Record<string, unknown>;
  return r['v'] === WIRE_VERSION && r['kind'] === ROOM_WIRE_KIND.pong;
}

export function sendPing(socket: WebSocket): void {
  socket.send(JSON.stringify({ v: WIRE_VERSION, kind: ROOM_WIRE_KIND.ping }));
}

type HeartbeatProbe = {
  handles: HeartbeatState;
  clock: Clock;
  timers: Timers;
  getSocket: () => WebSocket | null;
  heartbeatTimeoutMs: number;
  onMissed: () => void;
};

/** One outstanding ping on the ordered socket; repeated probes cannot postpone failure. */
export function probeHeartbeat(args: HeartbeatProbe): void {
  const socket = args.getSocket();
  if (
    socket === null ||
    socket.readyState !== WebSocket.OPEN ||
    args.handles.sentAt !== null
  )
    return;
  args.handles.sentAt = args.clock.now();
  args.handles.timeout = args.timers.setTimeout(() => {
    args.handles.timeout = null;
    args.handles.sentAt = null;
    args.onMissed();
  }, args.heartbeatTimeoutMs);
  try {
    sendPing(socket);
  } catch {
    clearHeartbeat(args.handles, args.timers);
    args.onMissed();
  }
}

export function acknowledgeHeartbeat(
  handles: HeartbeatState,
  clock: Clock,
  timers: Timers
): number | null {
  const sentAt = handles.sentAt;
  handles.sentAt = null;
  if (handles.timeout !== null) {
    timers.clearTimeout(handles.timeout);
    handles.timeout = null;
  }
  if (sentAt === null) return null;
  const elapsed = clock.now() - sentAt;
  return Number.isFinite(elapsed) && elapsed >= 0 ? elapsed : null;
}

/**
 * Starts an interval that sends `ping` and arms a one-shot timeout; if the
 * timeout fires before a pong is observed, `onMissed` runs.
 */
export function startHeartbeat(
  args: HeartbeatProbe & {
    heartbeatMs: number;
  }
): void {
  clearHeartbeat(args.handles, args.timers);
  args.handles.interval = args.timers.setInterval(
    () => probeHeartbeat(args),
    args.heartbeatMs
  );
}

export function raceWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
  timers: Timers
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = timers.setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    promise.then(
      (v) => {
        timers.clearTimeout(timer);
        resolve(v);
      },
      (err: unknown) => {
        timers.clearTimeout(timer);
        reject(err);
      }
    );
  });
}
