import { createSimPubSubBroker } from './pubsub-bridge';
import { BROKER, SERVER_PUB } from './traffic';
import type { BootedSimKernel } from './world-types';

function createBroker(k: BootedSimKernel) {
  return createSimPubSubBroker({
    network: k.network,
    brokerId: BROKER,
    faults: k.faults,
    rng: k.rng.fork(`broker-${k.rng.int(0xffff).toString(16)}`),
    liveResendOnReconnect: k.worldArgs.liveResendOnReconnect === true,
  });
}

/** Drop the pubsub broker endpoint (live pushes stop until restart). */
export function crashBrokerImpl(k: BootedSimKernel): void {
  k.broker.dispose();
}

/** Recreate broker, remake server pubsub, and reconnect live clients. */
export async function restartBrokerImpl(k: BootedSimKernel): Promise<void> {
  const clients = [...k.clients.values()];
  for (const client of clients) {
    await drainDisconnect(k, client.disconnect());
  }
  k.broker.dispose();
  k.broker = createBroker(k);
  k.serverPub = k.broker.createPubSub(SERVER_PUB);
  for (const client of clients) {
    await client.connect();
  }
}

async function drainDisconnect(
  k: BootedSimKernel,
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
    throw new Error('SimWorld: disconnect timeout during broker restart');
  }
  await disconnect;
}
