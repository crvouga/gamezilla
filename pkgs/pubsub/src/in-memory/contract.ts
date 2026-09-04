import { afterAll, beforeAll, describe } from 'bun:test';
import { registerCoreContractTests } from './contract-core';
import { bindContractIo } from './contract-helpers';
import {
  registerPublishOnlyContractTests,
  registerStatusContractTests,
} from './contract-status';
import type {
  PubSubContractEnv,
  PubSubContractFactory,
} from './contract-types';

export type {
  PubSubContractEnv,
  PubSubContractFactory,
} from './contract-types';

/**
 * Runs the PubSub semantics contract against a factory.
 * Compiles against port types only — adapters import this from `@pkgs/pubsub/in-memory`.
 */
export function runPubSubContractTests(
  name: string,
  factory: PubSubContractFactory
): void {
  describe(`PubSub contract: ${name}`, () => {
    let env: PubSubContractEnv | undefined;

    beforeAll(async () => {
      env = await factory();
      bindContractIo(env.clock, env.timers);
    });

    afterAll(async () => {
      await env?.teardown();
      env = undefined;
    });

    const getEnv = (): PubSubContractEnv => {
      if (!env) throw new Error('contract env not initialized');
      return env;
    };

    registerCoreContractTests(getEnv);
    registerStatusContractTests(getEnv);
    registerPublishOnlyContractTests(getEnv);
  });
}
