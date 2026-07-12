import type { SecretEntry } from './types';

/** Optional — derived default `auto` is populated by `VaultResource`
 * when absent. Listed here so the value (when set) is validated and the
 * orphan check recognizes it as managed. */
export class TurboLogOrder implements SecretEntry {
  readonly secretKey = 'TURBO_LOG_ORDER';
  readonly env = 'TURBO_LOG_ORDER';
  readonly hint = 'stream';
  readonly optional = true;

  async validate(): Promise<string | null> {
    return null;
  }
}
