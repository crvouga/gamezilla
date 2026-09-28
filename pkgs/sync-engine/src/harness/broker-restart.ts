import type { BootedHarnessKernel } from './harness-types';
import { createHarnessPubSubBroker } from './pubsub-bridge';
import { BROKER, SERVER_PUB } from './traffic';

function createBroker(k: BootedHarnessKernel) {
  return createHarnessPubSubBroker({
    network: k.network,
    brokerId: BROKER,
    faults: k.faults,
    rng: k.rng.fork('broker-restart'),
    liveResendOnReconnect: k.clientOpts.liveResendOnReconnect === true,
  });
}

/** Drop the pubsub broker endpoint (live pushes stop until restart). */
export function crashBrokerImpl(k: BootedHarnessKernel): void {
  k.broker.dispose();
}

/**
 * Recreate broker, remake server pubsub, and reconnect live clients. A client
 * that was disconnected (its app taken offline) stays disconnected: a broker
 * coming back does not bring an offline device online.
 */
export async function restartBrokerImpl(k: BootedHarnessKernel): Promise<void> {
  const live = [...k.clients.values()].filter(
    (client) => client.connection() !== 'disconnected'
  );
  for (const client of live) {
    await drainDisconnect(k, client.disconnect());
  }
  k.broker.dispose();
  k.broker = createBroker(k);
  k.serverPub = k.broker.createPubSub(SERVER_PUB);
  for (const client of live) {
    await client.connect();
  }
}

async function drainDisconnect(
  k: BootedHarnessKernel,
  disconnect: Promise<void>
): Promise<void> {
  let done = false;
  void disconnect.finally(() => {
    done = true;
  });
  const ok = await k.scheduler.runUntil(() => done, {
    maxVirtualMs: 5_000,
    maxSteps: 50_000,
  });
  if (!ok) {
    throw new Error(
      'SyncHarnessRuntime: disconnect timeout during broker restart'
    );
  }
  await disconnect;
}
