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
