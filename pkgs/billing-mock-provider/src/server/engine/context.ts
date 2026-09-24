/**
 * What every engine step runs with: the transaction, the injected clock and
 * id source, the catalog, and the events the step emits. Billing time is the
 * customer's test clock — the provider's clock plus that customer's offset —
 * in unix seconds, like the wire.
 */
import type { MockBillingCatalog } from '@pkgs/billing-mock/catalog';
import {
  MOCK_BILLING_API_VERSION,
  type MockEvent,
  type MockEventObject,
  type MockEventType,
} from '@pkgs/billing-mock/wire';
import type { Clock } from '@pkgs/clock';
import type { CreateId } from '@pkgs/uuid/create-id';

import { mintId } from '../ids';
import type { ProviderDb } from '../store';

export type EngineDeps = {
  readonly clock: Clock;
  readonly createId: CreateId;
  readonly catalog: MockBillingCatalog;
  /** The provider's public origin, for hosted-page URLs. */
  readonly origin: string;
};

export type Engine = {
  readonly db: ProviderDb;
  readonly deps: EngineDeps;
};

export const DAY_S = 24 * 60 * 60;

/** The customer's test-clock time, in unix seconds. */
export async function customerNowS(
  engine: Engine,
  customer: string
): Promise<number> {
  const offsetMs = await engine.db.clockOffsetMs(customer);
  return Math.floor((engine.deps.clock.now() + offsetMs) / 1000);
}

export function mint(engine: Engine, prefix: string): string {
  return mintId(engine.deps.createId, prefix);
}

/**
 * Records an event for delivery. It is delivered after the step's
 * transaction commits, so a rolled-back step sends nothing.
 */
export async function emit(
  engine: Engine,
  args: {
    readonly type: MockEventType;
    readonly object: MockEventObject;
    readonly createdS: number;
    readonly previous?: Readonly<Record<string, unknown>>;
  }
): Promise<void> {
  const event: MockEvent = {
    id: mint(engine, 'evt'),
    object: 'event',
    type: args.type,
    created: args.createdS,
    livemode: false,
    api_version: MOCK_BILLING_API_VERSION,
    data: {
      object: args.object,
      ...(args.previous === undefined
        ? {}
        : { previous_attributes: args.previous }),
    },
  };
  await engine.db.insertEvent(event, engine.deps.clock.now());
}

/** The fields of `before` that differ in `after`, as they were before. */
export function previousAttributes<T extends Record<string, unknown>>(
  before: T,
  after: T
): Readonly<Record<string, unknown>> {
  const previous: Record<string, unknown> = {};
  for (const key of Object.keys(after)) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      previous[key] = before[key];
    }
  }
  return previous;
}
