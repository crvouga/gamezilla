import type { SecretString } from '@pkgs/secret-string/secret-string';
import { VAULT_DEFAULTS } from '@pkgs/vault';
import {
  SecretBlankError,
  SecretMissingError,
  SecretStoreParseError,
  SecretStoreRequestError,
} from './errors';
import type {
  SecretStore,
  SecretStoreGetInit,
  SecretStoreSetInit,
} from './interface';
import { wrapSecret, wrapSecretOptional } from './wrap-secret';

export type VaultSecretStoreOptions = {
  token: string;
  /** Vault API address. @default {@link VAULT_DEFAULTS.addr} */
  addr?: string;
  /** KV v2 mount path. @default {@link VAULT_DEFAULTS.mount} */
  mount?: string;
  /** Project slug (first path segment). @default {@link VAULT_DEFAULTS.project} */
  project?: string;
  /** Config name (second path segment, e.g. `dev`, `prd`). */
  config?: string;
  /** @default globalThis.fetch */
  fetchFn?: VaultFetch;
  /**
   * On HTTP 429, retry up to this many extra attempts honoring `Retry-After`.
   * @default 3
   */
  rateLimitRetries?: number;
  /** Sleep helper, swappable for tests. @default `setTimeout` */
  sleep?: (ms: number) => Promise<void>;
};

type VaultFetch = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

const defaultFetch: VaultFetch = (input, init) => globalThis.fetch(input, init);

function assertNonBlankName(name: string): void {
  if (name.length === 0) {
    throw new SecretStoreRequestError('Secret name must be non-empty');
  }
}

type ParsedSecret = 'missing' | 'blank' | { readonly value: string };

function parseSecret(
  body: Record<string, unknown>,
  name: string
): ParsedSecret {
  if (!(name in body)) {
    return 'missing';
  }
  const raw = body[name];
  if (raw === null || raw === undefined) {
    return 'blank';
  }
  if (typeof raw !== 'string') {
    return 'blank';
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return 'blank';
  }
  return { value: trimmed };
}

function trimOpt(value: string | undefined): string | null {
  if (value === undefined) return null;
  const t = value.trim();
  return t.length > 0 ? t : null;
}

const DEFAULT_RATE_LIMIT_RETRIES = 3;
const RATE_LIMIT_BACKOFF_CAP_MS = 5_000;
const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

function parseRetryAfterMs(header: string | null): number | null {
  if (header === null) return null;
  const trimmed = header.trim();
  if (trimmed.length === 0) return null;
  const seconds = Number(trimmed);
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  return Math.min(Math.round(seconds * 1000), RATE_LIMIT_BACKOFF_CAP_MS);
}

function buildKvDataUrl(addr: string, mount: string, path: string): string {
  const base = addr.replace(/\/$/, '');
  return `${base}/v1/${mount}/data/${path}`;
}

function assertRecordObject(
  value: unknown,
  message: string
): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new SecretStoreParseError(message);
  }
  return value as Record<string, unknown>;
}

async function readJsonBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new SecretStoreParseError(
      'Vault KV read: response body is not valid JSON'
    );
  }
}

async function readVaultKvDataBody(
  response: Response
): Promise<Record<string, unknown>> {
  if (!response.ok) {
    throw new SecretStoreRequestError(
      `Vault KV read failed: HTTP ${response.status}`,
      response.status
    );
  }
  const root = assertRecordObject(
    await readJsonBody(response),
    'Vault KV read: expected JSON object body'
  );
  const dataWrapper = assertRecordObject(
    root['data'],
    'Vault KV read: expected { data: { data: { ... } } }'
  );
  return assertRecordObject(
    dataWrapper['data'],
    'Vault KV read: expected data.data object'
  );
}

export class VaultSecretStore implements SecretStore {
  private readonly token: string;
  private readonly addr: string;
  private readonly mount: string;
  private readonly projectSlug: string;
  private readonly configSlug: string | null;
  private readonly fetchFn: VaultFetch;
  private readonly rateLimitRetries: number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(options: VaultSecretStoreOptions) {
    const t = options.token.trim();
    if (t.length === 0) {
      throw new SecretStoreRequestError(
        'VaultSecretStore: token is required (non-empty string)'
      );
    }
    this.token = t;
    this.addr = trimOpt(options.addr) ?? VAULT_DEFAULTS.addr;
    this.mount = trimOpt(options.mount) ?? VAULT_DEFAULTS.mount;
    this.projectSlug = trimOpt(options.project) ?? VAULT_DEFAULTS.project;
    this.configSlug = trimOpt(options.config);
    this.fetchFn = options.fetchFn ?? defaultFetch;
    this.rateLimitRetries =
      options.rateLimitRetries !== undefined
        ? Math.max(0, Math.floor(options.rateLimitRetries))
        : DEFAULT_RATE_LIMIT_RETRIES;
    this.sleep = options.sleep ?? defaultSleep;
  }

  async getRequired(
    name: string,
    init?: SecretStoreGetInit
  ): Promise<SecretString> {
    assertNonBlankName(name);
    const row = await this.downloadSecretRow([name], init);
    return wrapSecret(name, this.requiredFromRow(row, name));
  }

  async getOptional(
    name: string,
    init?: SecretStoreGetInit
  ): Promise<SecretString | null> {
    assertNonBlankName(name);
    const row = await this.downloadSecretRow([name], init);
    return wrapSecretOptional(name, this.optionalFromRow(row, name));
  }

  async getRequiredMany(
    names: readonly string[],
    init?: SecretStoreGetInit
  ): Promise<Record<string, SecretString>> {
    if (names.length === 0) {
      return {};
    }
    for (const n of names) {
      assertNonBlankName(n);
    }
    const row = await this.downloadSecretRow(names, init);
    const out: Record<string, SecretString> = {};
    for (const name of names) {
      out[name] = wrapSecret(name, this.requiredFromRow(row, name));
    }
    return out;
  }

  async getOptionalMany(
    names: readonly string[],
    init?: SecretStoreGetInit
  ): Promise<Record<string, SecretString | null>> {
    if (names.length === 0) {
      return {};
    }
    for (const n of names) {
      assertNonBlankName(n);
    }
    const row = await this.downloadSecretRow(names, init);
    const out: Record<string, SecretString | null> = {};
    for (const name of names) {
      out[name] = wrapSecretOptional(name, this.optionalFromRow(row, name));
    }
    return out;
  }

  async setSecret(
    name: string,
    _value: string,
    _init?: SecretStoreSetInit
  ): Promise<void> {
    throw new SecretStoreRequestError(
      `VaultSecretStore is HTTP-read-only; cannot setSecret("${name}"). ` +
        'For Bun/Node scripts use createVaultSecretStoreForScripts() ' +
        'which routes writes through the Vault CLI.'
    );
  }

  private requiredFromRow(
    row: Record<string, ParsedSecret>,
    name: string
  ): string {
    const p = row[name];
    if (p === undefined) {
      throw new SecretStoreParseError(
        `Vault response row missing key "${name}"`
      );
    }
    if (p === 'missing') {
      throw new SecretMissingError(name);
    }
    if (p === 'blank') {
      throw new SecretBlankError(name);
    }
    return p.value;
  }

  private optionalFromRow(
    row: Record<string, ParsedSecret>,
    name: string
  ): string | null {
    const p = row[name];
    if (p === undefined || p === 'missing' || p === 'blank') {
      return null;
    }
    return p.value;
  }

  private secretPath(): string {
    if (this.configSlug === null) {
      throw new SecretStoreRequestError(
        'VaultSecretStore: config is required (set config option or VAULT_CONFIG)'
      );
    }
    return `${this.projectSlug}/${this.configSlug}`;
  }

  private async downloadSecretRow(
    names: readonly string[],
    init?: SecretStoreGetInit
  ): Promise<Record<string, ParsedSecret>> {
    const path = this.secretPath();
    const url = buildKvDataUrl(this.addr, this.mount, path);

    const requestInit: RequestInit = {
      method: 'GET',
      headers: {
        'X-Vault-Token': this.token,
        Accept: 'application/json',
      },
    };
    if (init?.signal !== undefined) {
      requestInit.signal = init.signal;
    }

    const response = await this.fetchWithRateLimitRetry(url, requestInit);
    const body = await readVaultKvDataBody(response);
    const out: Record<string, ParsedSecret> = {};
    for (const name of names) {
      out[name] = parseSecret(body, name);
    }
    return out;
  }

  private async fetchWithRateLimitRetry(
    url: string,
    init: RequestInit
  ): Promise<Response> {
    let attempt = 0;
    while (true) {
      let response: Response;
      try {
        response = await this.fetchFn(url, init);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        throw new SecretStoreRequestError(
          `Vault KV read failed (network): ${msg}`
        );
      }
      if (response.status !== 429 || attempt >= this.rateLimitRetries) {
        return response;
      }
      const retryAfterMs = parseRetryAfterMs(
        response.headers.get('Retry-After')
      );
      const backoffMs =
        retryAfterMs ?? Math.min(2 ** attempt * 250, RATE_LIMIT_BACKOFF_CAP_MS);
      attempt += 1;
      await this.sleep(backoffMs);
    }
  }
}
