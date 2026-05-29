import type { SecretString } from '@pkgs/secret-string/secret-string';
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

const DOPPLER_DOWNLOAD =
  'https://api.doppler.com/v3/configs/config/secrets/download';

export type DopplerSecretStoreOptions = {
  token: string;
  /**
   * Doppler project slug for the download API. Required for many personal/CLI
   * tokens; optional for config-scoped service tokens. Defaults to
   * `process.env.DOPPLER_PROJECT` when unset.
   */
  project?: string;
  /**
   * Doppler config name (e.g. `dev`, `prd`). Sent as the `config` query param
   * when set. Defaults to `process.env.DOPPLER_CONFIG`.
   */
  config?: string;
  /** @default globalThis.fetch */
  fetchFn?: DopplerFetch;
  /**
   * On HTTP 429 (rate-limited), retry up to this many extra attempts honoring
   * the `Retry-After` response header (seconds; falls back to exponential
   * backoff capped at 5s). `0` disables retries (test-friendly default).
   * @default 3
   */
  rateLimitRetries?: number;
  /** Sleep helper, swappable for tests. @default `setTimeout` */
  sleep?: (ms: number) => Promise<void>;
};

type DopplerFetch = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

const defaultFetch: DopplerFetch = (input, init) =>
  globalThis.fetch(input, init);

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

async function readDopplerJsonObjectBody(
  response: Response
): Promise<Record<string, unknown>> {
  if (!response.ok) {
    throw new SecretStoreRequestError(
      `Doppler secrets download failed: HTTP ${response.status}`,
      response.status
    );
  }
  let json: unknown;
  try {
    json = await response.json();
  } catch {
    throw new SecretStoreParseError(
      'Doppler secrets download: response body is not valid JSON'
    );
  }
  if (json === null || typeof json !== 'object' || Array.isArray(json)) {
    throw new SecretStoreParseError(
      'Doppler secrets download: expected JSON object body'
    );
  }
  return json as Record<string, unknown>;
}

/**
 * Doppler [Secrets Download](https://docs.doppler.com/reference/secrets-download)
 * using a config-scoped token (no `project` / `config` query params).
 */
function trimOpt(value: string | undefined): string | null {
  if (value === undefined) return null;
  const t = value.trim();
  return t.length > 0 ? t : null;
}

const DEFAULT_RATE_LIMIT_RETRIES = 3;
const RATE_LIMIT_BACKOFF_CAP_MS = 5_000;
const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Parses Doppler's `Retry-After` header. Doppler returns delta-seconds. Caps at
 * {@link RATE_LIMIT_BACKOFF_CAP_MS} so a misbehaving upstream cannot stall the
 * Worker request for arbitrary seconds.
 */
function parseRetryAfterMs(header: string | null): number | null {
  if (header === null) return null;
  const trimmed = header.trim();
  if (trimmed.length === 0) return null;
  const seconds = Number(trimmed);
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  return Math.min(Math.round(seconds * 1000), RATE_LIMIT_BACKOFF_CAP_MS);
}

export class DopplerSecretStore implements SecretStore {
  private readonly token: string;
  private readonly fetchFn: DopplerFetch;
  private readonly projectSlug: string | null;
  private readonly configSlug: string | null;
  private readonly rateLimitRetries: number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(options: DopplerSecretStoreOptions) {
    const t = options.token.trim();
    if (t.length === 0) {
      throw new SecretStoreRequestError(
        'DopplerSecretStore: token is required (non-empty string)'
      );
    }
    this.token = t;
    this.fetchFn = options.fetchFn ?? defaultFetch;
    this.projectSlug = trimOpt(options.project);
    this.configSlug = trimOpt(options.config);
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
    const unique = [...new Set(names)];
    const row = await this.downloadSecretRow(unique, init);
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
    const unique = [...new Set(names)];
    const row = await this.downloadSecretRow(unique, init);
    const out: Record<string, SecretString | null> = {};
    for (const name of names) {
      out[name] = wrapSecretOptional(name, this.optionalFromRow(row, name));
    }
    return out;
  }

  /**
   * Doppler's `secrets/download` is read-only — there is no symmetric write
   * endpoint we can call with the same auth flow. Use a CLI-backed factory
   * such as `createDopplerSecretStoreForScripts` (which composes this class
   * with `DopplerScriptSecretStore`) when you need writes.
   */
  async setSecret(
    name: string,
    _value: string,
    _init?: SecretStoreSetInit
  ): Promise<void> {
    throw new SecretStoreRequestError(
      `DopplerSecretStore is HTTP-read-only; cannot setSecret("${name}"). ` +
        'For Bun/Node scripts use createDopplerSecretStoreForScripts() ' +
        'which routes writes through the Doppler CLI.'
    );
  }

  private requiredFromRow(
    row: Record<string, ParsedSecret>,
    name: string
  ): string {
    const p = row[name];
    if (p === undefined) {
      throw new SecretStoreParseError(
        `Doppler response row missing key "${name}"`
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

  private async downloadSecretRow(
    names: readonly string[],
    init?: SecretStoreGetInit
  ): Promise<Record<string, ParsedSecret>> {
    const params = new URLSearchParams();
    params.set('format', 'json');
    params.set('secrets', names.join(','));
    if (this.projectSlug !== null) {
      params.set('project', this.projectSlug);
    }
    if (this.configSlug !== null) {
      params.set('config', this.configSlug);
    }

    const requestInit: RequestInit = {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: 'application/json',
      },
    };
    if (init?.signal !== undefined) {
      requestInit.signal = init.signal;
    }

    const url = `${DOPPLER_DOWNLOAD}?${params}`;
    const response = await this.fetchWithRateLimitRetry(url, requestInit);
    const body = await readDopplerJsonObjectBody(response);
    const out: Record<string, ParsedSecret> = {};
    for (const name of names) {
      out[name] = parseSecret(body, name);
    }
    return out;
  }

  /**
   * Calls Doppler with bounded retries on HTTP 429. Honors the `Retry-After`
   * header (seconds) when present and otherwise uses exponential backoff
   * capped at 5s. The Worker dev loop fans out 6+ concurrent secret reads on
   * every cold isolate; without backoff the Doppler edge returns 429 in a
   * tight loop and the wrangler reload churn never converges.
   */
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
          `Doppler secrets download failed (network): ${msg}`
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
