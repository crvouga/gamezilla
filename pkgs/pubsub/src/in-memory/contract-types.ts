import type { Clock, Timers } from '@pkgs/clock';

import type { PubSub } from '../interface';

export type PubSubContractEnv = {
  make: () => Promise<PubSub>;
  makePublishOnly?: () => Promise<PubSub>;
  disruptTransport?: (p: PubSub) => Promise<void>;
  /** Deliver a non-JSON frame to the subscriber's decode path. */
  injectMalformedInbound?: (subscriber: PubSub, topic: string) => Promise<void>;
  clock: Clock;
  timers: Timers;
  teardown: () => Promise<void>;
};

export type PubSubContractFactory = () => Promise<PubSubContractEnv>;

/**
 * Registration-time capabilities. Known before the env is built so the runner
 * reports unsupported cases as skipped instead of passing them silently.
 */
export type PubSubContractOptions = {
  /** Adapter provides `disruptTransport` (status + resubscribe cases). */
  readonly supportsDisruptTransport: boolean;
};
