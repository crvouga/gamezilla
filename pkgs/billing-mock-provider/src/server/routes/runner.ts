import type { Engine } from '../engine/context';

export type ProviderRunner = {
  /** One engine step in one transaction; webhooks go out after it commits. */
  run<T>(fn: (engine: Engine) => Promise<T>): Promise<T>;
};
