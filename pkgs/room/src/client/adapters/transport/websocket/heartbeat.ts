import {
  ROOM_WIRE_KIND,
  WIRE_VERSION,
} from '../../../../protocol/wire';

export type HeartbeatTimers = {
  interval: ReturnType<typeof setInterval> | null;
  timeout: ReturnType<typeof setTimeout> | null;
};

export function clearHeartbeatTimers(timers: HeartbeatTimers): void {
  if (timers.interval !== null) {
    clearInterval(timers.interval);
    timers.interval = null;
  }
  if (timers.timeout !== null) {
    clearTimeout(timers.timeout);
    timers.timeout = null;
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
  socket.send(
    JSON.stringify({ v: WIRE_VERSION, kind: ROOM_WIRE_KIND.ping })
  );
}

/**
 * Starts an interval that sends `ping` and arms a one-shot timeout; if the
 * timeout fires before a pong is observed (caller clears via
 * {@link clearHeartbeatTimers}), `onMissed` runs.
 */
export function startHeartbeat(args: {
  timers: HeartbeatTimers;
  getSocket: () => WebSocket | null;
  heartbeatMs: number;
  heartbeatTimeoutMs: number;
  onMissed: () => void;
}): void {
  clearHeartbeatTimers(args.timers);
  args.timers.interval = setInterval(() => {
    const s = args.getSocket();
    if (s === null || s.readyState !== WebSocket.OPEN) return;
    try {
      sendPing(s);
    } catch {
      args.onMissed();
      return;
    }
    if (args.timers.timeout !== null) clearTimeout(args.timers.timeout);
    args.timers.timeout = setTimeout(() => {
      args.timers.timeout = null;
      args.onMissed();
    }, args.heartbeatTimeoutMs);
  }, args.heartbeatMs);
}

export function raceWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}
