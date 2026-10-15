/** Best-effort events obey the same network cuts as HTTP and room connections. */

import type { Timers } from '@pkgs/clock-shared/types';
import type { PubSub, PubSubStatus } from '@pkgs/pubsub-root-shared/interface';
import { PubSubClosedError } from '@pkgs/pubsub-root-shared/pubsub-closed-error';
import { PubSubPublishError } from '@pkgs/pubsub-root-shared/pubsub-publish-error';

export const PUBSUB_HEARTBEAT_MS = 1_000;

export function partitionAwarePubSub(args: {
  readonly inner: PubSub;
  readonly reachable: () => boolean;
  readonly subscribeReachability: (listener: () => void) => () => void;
  readonly timers: Timers;
}): PubSub {
  const listeners = new Set<(status: PubSubStatus) => void>();
  let closed = false;
  const status = (): PubSubStatus =>
    closed || !args.reachable() ? 'down' : args.inner.status();
  let previous = status();
  const tick = (): void => {
    const next = status();
    if (closed || next === previous) return;
    previous = next;
    for (const listener of [...listeners]) listener(next);
  };
  const heartbeat = args.timers.setInterval(tick, PUBSUB_HEARTBEAT_MS);
  const stopStatus = args.inner.onStatus(tick);
  const stopReachability = args.subscribeReachability(tick);
  const assertOpen = (): void => {
    if (closed) throw new PubSubClosedError();
  };
  return {
    async publish(topic, data) {
      assertOpen();
      if (!args.reachable())
        throw new PubSubPublishError('harness events: server unreachable');
      await args.inner.publish(topic, data);
    },
    subscribe(topic, handler) {
      assertOpen();
      return args.inner.subscribe(topic, (data) => {
        tick();
        if (!closed && args.reachable()) handler(data);
      });
    },
    status,
    onStatus(listener) {
      if (!closed) listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    close() {
      if (closed) return;
      closed = true;
      args.timers.clearInterval(heartbeat);
      stopStatus();
      stopReachability();
      listeners.clear();
      args.inner.close();
    },
  };
}
