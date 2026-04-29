import { DopplerCli } from '../doppler/doppler-cli';
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
  /**
   * Doppler project slug for the download API. Required for many personal/CLI
   * tokens; optional for config-scoped service tokens. Defaults to
   * `process.env.DOPPLER_PROJECT` when unset.
   */
  project?: string;
  /**
   * Doppler config name (e.g. `local`, `prod`). Sent as the `config` query param
   * when set. Defaults to `options.configName`, then `process.env.DOPPLER_CONFIG`.
   */
  config?: string;
  /** @deprecated Prefer {@link DopplerSecretStoreOptions.config}. */
  configName?: string;
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
function trimOpt(value: string | undefined): string | null {
  if (value === undefined) return null;
  const t = value.trim();
  return t.length > 0 ? t : null;
}

export class DopplerSecretStore implements SecretStore {
  private readonly token: string;
  private readonly fetchFn: DopplerFetch;
  private readonly projectSlug: string | null;
  private readonly configSlug: string | null;

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
    this.configSlug =
      trimOpt(options.config) ?? trimOpt(options.configName);
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

/**
 * {@link DopplerSecretStore} for Node/Bun scripts (setup, migrations, QA).
 * Fills `project` / `config` from `DOPPLER_PROJECT` / `DOPPLER_CONFIG` or from
 * `doppler configure get … --plain` so personal CLI tokens work with the
 * secrets download API. Workers should use `new DopplerSecretStore({ token })`
 * with a config-scoped service token (no project/config query params).
 */
export function createDopplerSecretStoreForScripts(): DopplerSecretStore {
  const cli = new DopplerCli();
  const { token } = cli.resolveToken();
  const envProject =
    typeof process !== 'undefined'
      ? trimOpt(process.env['DOPPLER_PROJECT'])
      : null;
  const envConfig =
    typeof process !== 'undefined'
      ? trimOpt(process.env['DOPPLER_CONFIG'])
      : null;
  const project = envProject ?? cli.tryConfigureGetProjectPlain();
  const config = envConfig ?? cli.tryConfigureGetConfigPlain();
  return new DopplerSecretStore({
    token,
    ...(project !== null ? { project } : {}),
    ...(config !== null ? { config } : {}),
  });
}
