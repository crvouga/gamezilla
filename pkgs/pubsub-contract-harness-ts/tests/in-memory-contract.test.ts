import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import type { Clock, Timers } from '@pkgs/clock-shared-ts/types';
import { createNoopLogger } from '@pkgs/logger-shared-ts/logger';
import { runPubSubContractTests } from '@pkgs/pubsub-contract-harness-ts/contract';
import {
  createInMemoryBus,
  createInMemoryPubSub,
  InMemoryPubSub,
} from '@pkgs/pubsub-root-shared-ts/in-memory';

const logger = createNoopLogger();

async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 32; i += 1) await Promise.resolve();
}

/**
 * Virtual clock whose timers fire as soon as the microtask queue is quiet:
 * the contract's `waitMs` / `waitUntil` run on virtual time, never the wall.
 * The in-memory bus delivers synchronously, so nothing is outrun.
 */
function selfAdvancingHarnessClock(): { clock: Clock; timers: Timers } {
  const harness = createHarnessClock();
  let pumping = false;
  const pump = async (): Promise<void> => {
    if (pumping) return;
    pumping = true;
    try {
      for (;;) {
        await flushMicrotasks();
        const due = harness.clock.nextDueAt();
        if (due === null) return;
        harness.clock.set(Math.max(due, harness.clock.now()));
      }
    } finally {
      pumping = false;
    }
  };
  return {
    clock: harness.clock,
    timers: {
      ...harness.timers,
      setTimeout: (fn, ms) => {
        const handle = harness.timers.setTimeout(fn, ms);
        void pump();
        return handle;
      },
    },
  };
}

runPubSubContractTests(
  'in-memory',
  async () => {
    const bus = createInMemoryBus();
    return {
      make: async () => createInMemoryPubSub({ bus, logger }),
      injectMalformedInbound: async (subscriber, topic) => {
        if (!(subscriber instanceof InMemoryPubSub)) {
          throw new Error('expected InMemoryPubSub');
        }
        subscriber.deliverRawForTest(topic, 'not-json{{{');
      },
      ...selfAdvancingHarnessClock(),
      teardown: async () => undefined,
    };
  },
  { supportsDisruptTransport: false }
);
