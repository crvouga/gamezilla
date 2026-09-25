/**
 * Every secret the app needs. Registry lives in {@link ./registry}.
 *
 * A secret is either entered by a person (`bun run secrets:seed`) or written
 * by OpenTofu (`managedBy: 'tofu'` — generated once or derived from a
 * resource; see `libs/infra/tofu/stacks/foundation/secrets.json`).
 */

export type SecretsEnv = 'dev' | 'prd';

export type SecretInput = {
  readonly env: SecretsEnv;
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

export const SECRETS_ENVS: readonly SecretsEnv[] = ['dev', 'prd'] as const;

export function isSecretsEnv(value: string): value is SecretsEnv {
  return value === 'dev' || value === 'prd';
}

export function activeSecretsEnv(): SecretsEnv {
  const raw = (process.env['SECRETS_ENV'] ?? 'dev').trim();
  if (isSecretsEnv(raw)) return raw;
  throw new Error(
    `SECRETS_ENV must be "dev" or "prd", got ${JSON.stringify(raw)}`
  );
}
