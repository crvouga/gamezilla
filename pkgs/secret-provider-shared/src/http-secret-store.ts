import { SecretBlankError } from '@pkgs/secret-store-shared/secret-blank-error';
import { SecretMissingError } from '@pkgs/secret-store-shared/secret-missing-error';
import type { SecretStore, SecretStoreGetInit, SecretStoreSetInit } from '@pkgs/secret-store-shared/interface';
import { SecretStoreParseError } from '@pkgs/secret-store-shared/secret-store-parse-error';
import { SecretStoreRequestError } from '@pkgs/secret-store-shared/secret-store-request-error';
import { wrapSecret, wrapSecretOptional } from '@pkgs/secret-store-shared/wrap-secret';
import type { SecretString } from '@pkgs/secret-string-shared/secret-string';

export type InfisicalFetch = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

export type InfisicalSecretStoreOptions = {
  readonly domain: string;
  readonly workspaceId: string;
  readonly env: string;
  /** Service token or short-lived access token. */
  readonly token: string;
  readonly fetchFn: InfisicalFetch;
  readonly secretPath?: string;
};

type SecretRow = Record<string, string>;

function trimOpt(value: string | undefined): string | null {
  if (value === undefined) return null;
  const t = value.trim();
  return t.length > 0 ? t : null;
}

function normalizeDomain(domain: string): string {
  return domain.replace(/\/$/, '');
}

function parseSecretValue(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readSecretEntry(item: unknown): [string, string] | null {
  if (item === null || typeof item !== 'object' || Array.isArray(item)) {
    return null;
  }
  const entry = item as Record<string, unknown>;
  const key = entry['secretKey'];
  const value = parseSecretValue(entry['secretValue']);
  if (typeof key !== 'string' || value === null) return null;
  return [key, value];
}

function parseSecretsListBody(json: unknown): SecretRow {
  if (json === null || typeof json !== 'object' || Array.isArray(json)) {
    throw new SecretStoreParseError(
      'Infisical secrets list: expected JSON object body'
    );
  }
  const secrets = (json as Record<string, unknown>)['secrets'];
  if (!Array.isArray(secrets)) {
    throw new SecretStoreParseError(
      'Infisical secrets list: expected secrets array'
    );
  }
  const row: SecretRow = {};
  for (const item of secrets) {
    const entry = readSecretEntry(item);
    if (entry === null) continue;
    row[entry[0]] = entry[1];
  }
  return row;
}

async function readJsonResponse(
  response: Response,
  parseErrorMessage: string
): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new SecretStoreParseError(parseErrorMessage);
  }
}

function buildInfisicalListUrl(
  domain: string,
  workspaceId: string,
  env: string,
  secretPath: string
): URL {
  const url = new URL(`${domain}/api/v3/secrets/raw`);
  url.searchParams.set('workspaceId', workspaceId);
  url.searchParams.set('environment', env);
  url.searchParams.set('secretPath', secretPath);
  return url;
}

function buildRawSecretUrl(domain: string, name: string): URL {
  return new URL(`${domain}/api/v3/secrets/raw/${encodeURIComponent(name)}`);
}

function buildWriteBody(
  workspaceId: string,
  env: string,
  secretPath: string,
  secretValue: string
): Record<string, string> {
  return {
    workspaceId,
    environment: env,
    secretPath,
    secretValue,
    type: 'shared',
  };
}

function buildWriteHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

/** Infisical returns 409 or 400 `"Secret already exist"` when POST hits an existing key. */
function isSecretAlreadyExists(status: number, bodyText: string): boolean {
  if (status === 409) return true;
  if (status !== 400) return false;
  return /already exist/i.test(bodyText);
}

function formatSetSecretError(status: number, bodyText: string): string {
  const detail = bodyText.trim().slice(0, 200);
  if (detail.length === 0) {
    return `Infisical setSecret failed: HTTP ${status}`;
  }
  return `Infisical setSecret failed: HTTP ${status}: ${detail}`;
}

export class InfisicalSecretStore implements SecretStore {
  private readonly domain: string;
  private readonly workspaceId: string;
  private readonly env: string;
  private readonly token: string;
  private readonly secretPath: string;
  private readonly fetchFn: InfisicalFetch;
  private cache: SecretRow | null = null;

  constructor(options: InfisicalSecretStoreOptions) {
    const token = options.token.trim();
    if (token.length === 0) {
      throw new SecretStoreRequestError(
        'InfisicalSecretStore: token is required'
      );
    }
    this.domain = normalizeDomain(options.domain);
    this.workspaceId = options.workspaceId.trim();
    this.env = options.env.trim();
    this.token = token;
    this.secretPath = trimOpt(options.secretPath) ?? '/';
    this.fetchFn = options.fetchFn;
  }

  async getRequired(
    name: string,
    init?: SecretStoreGetInit
  ): Promise<SecretString> {
    const row = await this.loadRow(init);
    const value = row[name];
    if (value === undefined) {
      throw new SecretMissingError(name);
    }
    return wrapSecret(name, value);
  }

  async getOptional(
    name: string,
    init?: SecretStoreGetInit
  ): Promise<SecretString | null> {
    const row = await this.loadRow(init);
    const value = row[name];
    if (value === undefined) return null;
    return wrapSecretOptional(name, value);
  }

  async getRequiredMany(
    names: readonly string[],
    init?: SecretStoreGetInit
  ): Promise<Record<string, SecretString>> {
    const row = await this.loadRow(init);
    const out: Record<string, SecretString> = {};
    for (const name of names) {
      const value = row[name];
      if (value === undefined) {
        throw new SecretMissingError(name);
      }
      out[name] = wrapSecret(name, value);
    }
    return out;
  }

  async getOptionalMany(
    names: readonly string[],
    init?: SecretStoreGetInit
  ): Promise<Record<string, SecretString | null>> {
    const row = await this.loadRow(init);
    const out: Record<string, SecretString | null> = {};
    for (const name of names) {
      const value = row[name];
      out[name] = value === undefined ? null : wrapSecretOptional(name, value);
    }
    return out;
  }

  async setSecret(
    name: string,
    value: string,
    init?: SecretStoreSetInit
  ): Promise<void> {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      throw new SecretBlankError(name);
    }
    const created = await this.writeRawSecret(name, trimmed, 'POST', init);
    if (created.ok) {
      this.cache = null;
      return;
    }
    const createBody = await created.text();
    if (!isSecretAlreadyExists(created.status, createBody)) {
      throw new SecretStoreRequestError(
        formatSetSecretError(created.status, createBody),
        created.status
      );
    }
    const updated = await this.writeRawSecret(name, trimmed, 'PATCH', init);
    if (!updated.ok) {
      const updateBody = await updated.text();
      throw new SecretStoreRequestError(
        formatSetSecretError(updated.status, updateBody),
        updated.status
      );
    }
    this.cache = null;
  }

  private async writeRawSecret(
    name: string,
    secretValue: string,
    method: 'POST' | 'PATCH',
    init?: SecretStoreSetInit
  ): Promise<Response> {
    const requestInit: RequestInit = {
      method,
      headers: buildWriteHeaders(this.token),
      body: JSON.stringify(
        buildWriteBody(this.workspaceId, this.env, this.secretPath, secretValue)
      ),
    };
    if (init?.signal !== undefined) {
      requestInit.signal = init.signal;
    }
    return this.fetchFn(buildRawSecretUrl(this.domain, name), requestInit);
  }

  private async loadRow(init?: SecretStoreGetInit): Promise<SecretRow> {
    if (init?.force === true) {
      this.cache = null;
    }
    if (this.cache !== null) {
      return this.cache;
    }
    const row = await this.fetchSecretRow(init);
    this.cache = row;
    return row;
  }

  private async fetchSecretRow(init?: SecretStoreGetInit): Promise<SecretRow> {
    const url = buildInfisicalListUrl(
      this.domain,
      this.workspaceId,
      this.env,
      this.secretPath
    );
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
    const response = await this.fetchFn(url, requestInit);
    if (!response.ok) {
      throw new SecretStoreRequestError(
        `Infisical secrets list failed: HTTP ${response.status}`,
        response.status
      );
    }
    const json = await readJsonResponse(
      response,
      'Infisical secrets list: response body is not valid JSON'
    );
    return parseSecretsListBody(json);
  }
}

export function createInfisicalSecretStore(
  options: InfisicalSecretStoreOptions
): SecretStore {
  return new InfisicalSecretStore(options);
}
