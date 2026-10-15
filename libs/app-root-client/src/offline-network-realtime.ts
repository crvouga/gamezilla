import type { PubSub, PubSubStatus } from '@pkgs/pubsub-root-shared/interface';
import { PubSubClosedError } from '@pkgs/pubsub-root-shared/pubsub-closed-error';
import type { Topic } from '@pkgs/pubsub-root-shared/topic';
import type {
  ClientTransport,
  ClientTransportHandlers,
} from '@pkgs/room-root-shared/transport';
import type { OfflineNetworkController } from './offline-network-controller';
import { offlineNetworkError } from './offline-network-http';

type Subscription = {
  readonly topic: Topic;
  readonly handler: (data: unknown) => void;
  detach: (() => void) | null;
};

/** A push connection that is physically absent while voluntary offline is on. */
export function createOfflinePubSub(
  offline: OfflineNetworkController,
  open: () => PubSub | null,
  initial?: PubSub
): PubSub {
  const subscriptions = new Set<Subscription>();
  const statusListeners = new Set<(status: PubSubStatus) => void>();
  let inner: PubSub | null = initial ?? null;
  let detachStatus: (() => void) | null = null;
  let closed = false;
  const notify = (status: PubSubStatus): void => {
    for (const listener of [...statusListeners]) listener(status);
  };
  const disconnect = (): void => {
    if (inner === null) return;
    const live = inner;
    inner = null;
    detachStatus?.();
    detachStatus = null;
    for (const subscription of subscriptions) subscription.detach = null;
    live.close();
    notify('down');
  };
  const connect = (): PubSub | null => {
    if (closed || offline.isOffline()) return null;
    if (inner !== null) return inner;
    const live = open();
    if (live === null) return null;
    inner = live;
    detachStatus = live.onStatus(notify);
    for (const subscription of subscriptions) {
      subscription.detach = live.subscribe(
        subscription.topic,
        subscription.handler
      );
    }
    notify(live.status());
    return live;
  };
  if (initial !== undefined) detachStatus = initial.onStatus(notify);
  const stopOffline = offline.subscribe((isOffline) => {
    if (isOffline) disconnect();
    else connect();
  });
  return {
    async publish(topic, data) {
      if (closed) throw new PubSubClosedError();
      const live = connect();
      if (live === null) throw offlineNetworkError();
      await live.publish(topic, data);
    },
    subscribe(topic, handler) {
      if (closed) throw new PubSubClosedError();
      const subscription: Subscription = { topic, handler, detach: null };
      subscriptions.add(subscription);
      const live = connect();
      if (live !== null && subscription.detach === null) {
        subscription.detach = live.subscribe(topic, handler);
      }
      return () => {
        subscription.detach?.();
        subscriptions.delete(subscription);
      };
    },
    status: () =>
      closed || offline.isOffline() ? 'down' : (inner?.status() ?? 'down'),
    onStatus(listener) {
      if (closed) return () => undefined;
      statusListeners.add(listener);
      return () => statusListeners.delete(listener);
    },
    close() {
      if (closed) return;
      closed = true;
      stopOffline();
      disconnect();
      subscriptions.clear();
      statusListeners.clear();
    },
  };
}

function relayHandlers(
  handlers: ReadonlySet<ClientTransportHandlers>
): ClientTransportHandlers {
  return {
    onOpen: () => {
      for (const handler of [...handlers]) handler.onOpen?.();
    },
    onClose: () => {
      for (const handler of [...handlers]) handler.onClose?.();
    },
    onError: (error) => {
      for (const handler of [...handlers]) handler.onError?.(error);
    },
  };
}

/** Room transport that destroys its socket synchronously when offline is chosen. */
export function createOfflineRoomTransport(
  offline: OfflineNetworkController,
  open: () => ClientTransport
): ClientTransport {
  const frames = new Set<(raw: unknown) => void>();
  const handlers = new Set<ClientTransportHandlers>();
  const relay = relayHandlers(handlers);
  let inner: ClientTransport | null = null;
  let wanted = false;
  let destroyed = false;
  const disconnect = (): void => {
    if (inner === null) return;
    const live = inner;
    inner = null;
    live.destroy();
    relay.onClose?.();
  };
  const attach = (): ClientTransport => {
    const live = open();
    live.subscribe((raw) => {
      for (const handler of [...frames]) handler(raw);
    });
    live.onHandlers({
      onOpen: () => relay.onOpen?.(),
      onClose: () => {
        if (inner !== live) return;
        // The adapter still owns reconnect timers after its socket closes.
        // Retain it so an offline transition can destroy those timers too.
        relay.onClose?.();
      },
      onError: (error) => relay.onError?.(error),
    });
    inner = live;
    return live;
  };
  const connect = async (): Promise<void> => {
    if (destroyed) throw new Error('room transport destroyed');
    wanted = true;
    if (offline.isOffline()) throw offlineNetworkError();
    // An attempt that fails leaves the adapter in place: it owns the retries
    // that bring the room back when the connection does.
    await Promise.resolve((inner ?? attach()).connect());
  };
  const stopOffline = offline.subscribe((isOffline) => {
    if (isOffline) disconnect();
    else if (wanted && !destroyed) {
      void connect().catch((error: unknown) => relay.onError?.(error));
    }
  });
  return {
    get isConnected() {
      return !offline.isOffline() && (inner?.isConnected ?? false);
    },
    connect,
    sendJson(payload) {
      if (offline.isOffline()) throw offlineNetworkError();
      inner?.sendJson(payload);
    },
    subscribe(handler) {
      frames.add(handler);
      return () => frames.delete(handler);
    },
    onHandlers(handler) {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      wanted = false;
      stopOffline();
      disconnect();
      frames.clear();
      handlers.clear();
    },
    probeLiveness() {
      if (!offline.isOffline()) inner?.probeLiveness?.();
    },
  };
}
