/**
 * Every secret the app needs. Registry lives in {@link ./registry}.
 *
 * A secret is either entered by a person (`bun run secrets:seed`) or written
 * by OpenTofu (`managedBy: 'tofu'` — generated once or derived from a
 * resource; see `libs/infra-shared-ts/tofu/stacks/foundation/secrets.json`).
 */

import type { EnvFile } from '@libs/infra-shared-ts/env-file';
import { envFile } from '@libs/infra-shared-ts/envs';

export type SecretInput = {
  /** The environment the value is for (production-ness is its `protection`). */
  readonly env: EnvFile;
  readonly secretValue: string;
  /** All values already fetched for this env — for cross-secret checks. */
  readonly secrets: ReadonlyMap<string, string>;
};

export type SecretConfig = {
  readonly name: string;
  readonly hint: string;
  readonly optional?: boolean;
  /** Include in wrangler secret bulk + `.dev.vars` worker payload. */
  readonly pushToApiWorker?: boolean;
  /**
   * `tofu`: written by `@libs/infra#apply:foundation` (never by a person);
   * `bun run secrets:seed` skips it unless named explicitly.
   */
  readonly managedBy?: 'tofu';
  validate(input: SecretInput): Promise<void>;
};

export class Secret {
  readonly name: string;
  readonly hint: string;
  readonly optional: boolean;
  readonly pushToApiWorker: boolean;
  readonly managedBy: 'tofu' | null;
  readonly validate: (input: SecretInput) => Promise<void>;

  constructor(config: SecretConfig) {
    this.name = config.name;
    this.hint = config.hint;
    this.optional = config.optional === true;
    this.pushToApiWorker = config.pushToApiWorker === true;
    this.managedBy = config.managedBy ?? null;
    this.validate = config.validate.bind(config);
  }
}

/** Run {@link Secret.validate}; return error message or null (setup / legacy). */
export async function validateSecretOrError(
  secret: Secret,
  input: SecretInput
): Promise<string | null> {
  try {
    await secret.validate(input);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

export function requireNonEmpty(value: string, label?: string): void {
  if (value.trim().length === 0) {
    throw new Error(
      label !== undefined ? `${label} must be non-empty` : 'Must be non-empty'
    );
  }
}

export function requireHttpsUrl(value: string, label?: string): void {
  const v = value.trim();
  requireNonEmpty(v, label);
  let url: URL;
  try {
    url = new URL(v);
  } catch {
    throw new Error(
      label !== undefined
        ? `${label} must be a valid URL`
        : 'Must be a valid URL'
    );
  }
  if (url.protocol !== 'https:') {
    throw new Error(
      label !== undefined ? `${label} must use https://` : 'Must use https://'
    );
  }
}

/**
 * The environment `SECRETS_ENV` names (default `dev`). Any environment with a
 * `libs/infra-shared-ts/tofu/envs/<env>.tfvars.json` is valid; anything else throws.
 */
export function activeEnvFile(): EnvFile {
  return envFile((process.env['SECRETS_ENV'] ?? 'dev').trim());
}
