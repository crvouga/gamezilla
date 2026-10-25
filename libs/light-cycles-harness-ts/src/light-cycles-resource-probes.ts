import { FixedStepSimulation } from '@libs/game-session-shared-ts/simulation-engine';

/** Live subscriptions, opened through a probe and not yet closed. */
export type SubscriptionLedger = { active: number };

function counted(
  ledger: SubscriptionLedger,
  unsubscribe: () => unknown
): () => void {
  ledger.active += 1;
  let open = true;
  return () => {
    if (open) {
      open = false;
      ledger.active -= 1;
    }
    unsubscribe();
  };
}

const SUBSCRIBERS = new Set<PropertyKey>([
  'subscribe',
  'subscribeSignal',
  'subscribeCommandResult',
]);

/** The same room client, with every subscription it hands out counted. */
export function countingRoom<R extends object>(
  room: R,
  ledger: SubscriptionLedger
): R {
  return new Proxy(room, {
    get(target, key) {
      const value: unknown = Reflect.get(target, key, target);
      if (typeof value !== 'function') return value;
      const bound = (value as (...args: unknown[]) => unknown).bind(target);
      if (!SUBSCRIBERS.has(key)) return bound;
      return (...args: unknown[]) =>
        counted(ledger, bound(...args) as () => unknown);
    },
  });
}

const ticks: SubscriptionLedger = { active: 0 };
let installed = false;

/**
 * Counts every engine tick subscription in this process from now on. The
 * engine is constructed inside the session runtime, so the count is taken
 * where every subscription is made: the engine's own method.
 */
export function activeTickSubscriptions(): number {
  if (!installed) {
    installed = true;
    const subscribe = FixedStepSimulation.prototype.subscribeTicks;
    FixedStepSimulation.prototype.subscribeTicks = function (
      this: FixedStepSimulation<unknown, unknown>,
      listener
    ) {
      return counted(ticks, subscribe.call(this, listener));
    };
  }
  return ticks.active;
}
