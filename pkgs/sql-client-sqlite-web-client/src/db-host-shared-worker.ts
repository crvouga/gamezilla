// @io-wall-ok — SharedWorker entry: wall clock/timers for heartbeat reaping only.
/// <reference lib="webworker" />

import type { BrokerPort } from '@pkgs/sql-client-sqlite-web-shared/broker-core';
import { createBrokerCore } from '@pkgs/sql-client-sqlite-web-shared/broker-core';

declare const self: SharedWorkerGlobalScope;

let nextPortId = 0;

const broker = createBrokerCore({
  setTimeout: (fn, ms) => self.setTimeout(fn, ms),
  clearTimeout: (id) => self.clearTimeout(id as number),
  now: () => Date.now(),
});

self.setInterval(() => {
  broker.tickHeartbeatReaper();
}, 5_000);

self.onconnect = (event: MessageEvent) => {
  const port = event.ports[0];
  if (port === undefined) return;
  const id = `port_${++nextPortId}`;
  const brokerPort: BrokerPort = {
    id,
    postMessage: (message) => {
      port.postMessage(message);
    },
    close: () => {
      port.close();
    },
  };
  broker.attachPort(brokerPort);
  port.start();
  port.onmessage = (msgEvent: MessageEvent) => {
    broker.handleMessage(id, msgEvent.data);
  };
  port.onmessageerror = () => {
    broker.detachPort(id);
  };
  // Detach immediately when the tab/port dies (don't wait for heartbeat reap).
  port.addEventListener('close', () => {
    broker.detachPort(id);
  });
};
