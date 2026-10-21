/**
 * The network between a person and the deployed API, for the localhost
 * stack. Loopback answers in microseconds, which hides every ordering race a
 * real round trip opens: a gesture made before the screen takes it, a
 * subscription made before the server knows the person belongs. The wall
 * `sleep` comes from the composition root; a test passes its own.
 */
export type EdgeLatency = {
  /** One-way delay, in milliseconds. */
  readonly ms: number;
  sleep(ms: number): Promise<void>;
};

export const NO_EDGE_LATENCY: EdgeLatency = {
  ms: 0,
  sleep: () => Promise.resolve(),
};

export type Lagged = {
  /** Resolves once one way across the network has passed. */
  after(): Promise<void>;
  /** Runs `send` one way later than the one before it, never ahead of it. */
  inOrder(send: () => void): void;
};

export function lagged(latency: EdgeLatency): Lagged {
  let tail: Promise<void> = Promise.resolve();
  return {
    after: () =>
      latency.ms > 0 ? latency.sleep(latency.ms) : Promise.resolve(),
    inOrder(send) {
      if (latency.ms === 0) {
        send();
        return;
      }
      tail = tail.then(async () => {
        await latency.sleep(latency.ms);
        send();
      });
    },
  };
}
