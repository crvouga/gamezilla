import type { Timers } from '@pkgs/clock-shared-ts/types';

import { ROOM_WIRE_KIND, WIRE_VERSION } from '@pkgs/room-root-shared-ts/wire';

export type HeartbeatTimers = {
  interval: unknown | null;
  timeout: unknown | null;
};

export function clearHeartbeatTimers(
  handles: HeartbeatTimers,
  timers: Timers
): void {
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

/**
 * Starts an interval that sends `ping` and arms a one-shot timeout; if the
 * timeout fires before a pong is observed (caller clears via
 * {@link clearHeartbeatTimers}), `onMissed` runs.
 */
export function startHeartbeat(args: {
  handles: HeartbeatTimers;
  timers: Timers;
  getSocket: () => WebSocket | null;
  heartbeatMs: number;
  heartbeatTimeoutMs: number;
  onMissed: () => void;
}): void {
  const { timers } = args;
  clearHeartbeatTimers(args.handles, timers);
  args.handles.interval = timers.setInterval(() => {
    const s = args.getSocket();
    if (s === null || s.readyState !== WebSocket.OPEN) return;
    try {
      sendPing(s);
    } catch {
      args.onMissed();
      return;
    }
    if (args.handles.timeout !== null) {
      timers.clearTimeout(args.handles.timeout);
    }
    args.handles.timeout = timers.setTimeout(() => {
      args.handles.timeout = null;
      args.onMissed();
    }, args.heartbeatTimeoutMs);
  }, args.heartbeatMs);
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
