import { createSimPubSubBroker } from './pubsub-bridge';
import { BROKER } from './traffic';
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

/** Recreate broker and reconnect live clients. */
export async function restartBrokerImpl(k: BootedSimKernel): Promise<void> {
  k.broker.dispose();
  k.broker = createBroker(k);
  for (const client of k.clients.values()) {
    await client.disconnect();
    await client.connect();
  }
}
