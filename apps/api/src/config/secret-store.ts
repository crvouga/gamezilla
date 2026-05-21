import type { SecretStore } from '@pkgs/secret-store';
import {
  createCachingSecretStore,
  DopplerSecretStore,
} from '@pkgs/secret-store';

export type CreateApiSecretStoreOptions = {
  /**
   * Optional Doppler project slug. Required by the secrets-download API when
   * the token is not a config-scoped service token (e.g. dev `.dev.vars` uses
   * a CLI token `dp.ct.…`). Leave `null` in production with `dp.st.…`.
   */
  readonly project?: string | null;
  /** Optional Doppler config name. See {@link CreateApiSecretStoreOptions.project}. */
  readonly config?: string | null;
};

/**
 * Doppler secrets for this Worker. In production the config-scoped
 * `DOPPLER_TOKEN` carries the project/config implicitly, so `project`/`config`
 * are omitted. In dev, `setup-dev-vars` writes a CLI token plus
 * `DOPPLER_PROJECT`/`DOPPLER_CONFIG` so the same code path works.
 */
export function createApiSecretStore(
  token: string,
  options: CreateApiSecretStoreOptions = {}
): SecretStore {
  const project = options.project ?? null;
  const config = options.config ?? null;
  const store = new DopplerSecretStore({
    token,
    ...(project !== null ? { project } : {}),
    ...(config !== null ? { config } : {}),
  });
  return createCachingSecretStore(store, { ttlMs: 300_000 });
}
