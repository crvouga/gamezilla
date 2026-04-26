import {
  SecretBlankError,
  SecretMissingError,
  SecretStoreParseError,
  SecretStoreRequestError,
} from './errors';
import type { SecretStore, SecretStoreGetInit } from './interface';

const DOPPLER_DOWNLOAD =
  'https://api.doppler.com/v3/configs/config/secrets/download';

export type DopplerSecretStoreOptions = {
  token: string;
  /** Optional Doppler config name, e.g. 'shared'. */
  configName?: 'shared';
  /** @default globalThis.fetch */
  fetchFn?: DopplerFetch;
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
export class DopplerSecretStore implements SecretStore {
  private readonly token: string;
  private readonly fetchFn: DopplerFetch;
  private readonly configName: string | null;

  constructor(options: DopplerSecretStoreOptions) {
    const t = options.token.trim();
    if (t.length === 0) {
      throw new SecretStoreRequestError(
        'DopplerSecretStore: token is required (non-empty string)'
      );
    }
    this.token = t;
    this.fetchFn = options.fetchFn ?? defaultFetch;
    const c = options.configName?.trim();
    this.configName = c !== undefined && c.length > 0 ? c : null;
  }

  async getRequired(name: string, init?: SecretStoreGetInit): Promise<string> {
    assertNonBlankName(name);
    const row = await this.downloadSecretRow([name], init);
    return this.requiredFromRow(row, name);
  }

  async getOptional(
    name: string,
    init?: SecretStoreGetInit
  ): Promise<string | null> {
    assertNonBlankName(name);
    const row = await this.downloadSecretRow([name], init);
    return this.optionalFromRow(row, name);
  }

  async getRequiredMany(
    names: readonly string[],
    init?: SecretStoreGetInit
  ): Promise<Record<string, string>> {
    if (names.length === 0) {
      return {};
    }
    for (const n of names) {
      assertNonBlankName(n);
    }
    const unique = [...new Set(names)];
    const row = await this.downloadSecretRow(unique, init);
    const out: Record<string, string> = {};
    for (const name of names) {
      out[name] = this.requiredFromRow(row, name);
    }
    return out;
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
    if (this.configName !== null) {
      params.set('config', this.configName);
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

    let response: Response;
    try {
      response = await this.fetchFn(
        `${DOPPLER_DOWNLOAD}?${params}`,
        requestInit
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new SecretStoreRequestError(
        `Doppler secrets download failed (network): ${msg}`
      );
    }

    const body = await readDopplerJsonObjectBody(response);
    const out: Record<string, ParsedSecret> = {};
    for (const name of names) {
      out[name] = parseSecret(body, name);
    }
    return out;
  }
}
