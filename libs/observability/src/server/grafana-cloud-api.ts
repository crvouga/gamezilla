import type { HttpClient } from '@pkgs/http-client';
import { GrafanaCloudApiError } from './grafana-cloud-api-error';

const GRAFANA_API = 'https://grafana.com/api';

export type GrafanaStack = {
  readonly id: number;
  readonly slug: string;
  readonly status: string;
  readonly regionSlug: string;
  readonly htInstanceId: number;
  readonly htInstanceUrl: string;
};

export type GrafanaAccessPolicy = {
  readonly id: string;
  readonly name: string;
  readonly scopes: readonly string[];
};

export type GrafanaToken = {
  readonly id: string;
  readonly name: string;
};

type Items<T> = { readonly items?: readonly T[] };

/** Minimal Grafana Cloud API client (stacks, access policies, tokens). */
export class GrafanaCloudApi {
  readonly #http: HttpClient;
  readonly #token: string;

  constructor(http: HttpClient, token: string) {
    this.#http = http;
    this.#token = token;
  }

  async #request<T>(
    label: string,
    path: string,
    init: { readonly method?: string; readonly body?: unknown } = {}
  ): Promise<T | null> {
    const res = await this.#http.fetch(`${GRAFANA_API}${path}`, {
      method: init.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${this.#token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
    });
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new GrafanaCloudApiError(label, res.status, await res.text());
    }
    const text = await res.text();
    return text.length === 0 ? ({} as T) : (JSON.parse(text) as T);
  }

  async #required<T>(
    label: string,
    path: string,
    init?: { readonly method?: string; readonly body?: unknown }
  ): Promise<T> {
    const value = await this.#request<T>(label, path, init);
    if (value === null) throw new GrafanaCloudApiError(label, 404, path);
    return value;
  }

  getStack(slug: string): Promise<GrafanaStack | null> {
    return this.#request('get stack', `/instances/${encodeURIComponent(slug)}`);
  }

  createStack(input: {
    readonly slug: string;
    readonly region: string;
  }): Promise<GrafanaStack> {
    return this.#required('create stack', '/instances', {
      method: 'POST',
      body: { name: input.slug, slug: input.slug, region: input.region },
    });
  }

  async getOtlpHttpUrl(slug: string): Promise<string> {
    const body = await this.#required<{ readonly otlpHttpUrl?: string }>(
      'get stack connections',
      `/instances/${encodeURIComponent(slug)}/connections`
    );
    const url = body.otlpHttpUrl?.trim() ?? '';
    if (url.length === 0) {
      throw new Error(`Grafana Cloud stack ${slug} has no otlpHttpUrl`);
    }
    return url;
  }

  async findAccessPolicy(
    region: string,
    name: string
  ): Promise<GrafanaAccessPolicy | null> {
    const q = new URLSearchParams({ region, name });
    const body = await this.#required<Items<GrafanaAccessPolicy>>(
      'list access policies',
      `/v1/accesspolicies?${q.toString()}`
    );
    return body.items?.find((p) => p.name === name) ?? null;
  }

  upsertAccessPolicy(input: {
    readonly region: string;
    readonly existingId: string | null;
    readonly name: string;
    readonly scopes: readonly string[];
    readonly stackId: number;
  }): Promise<GrafanaAccessPolicy> {
    const q = new URLSearchParams({ region: input.region });
    const path =
      input.existingId === null
        ? `/v1/accesspolicies?${q.toString()}`
        : `/v1/accesspolicies/${encodeURIComponent(input.existingId)}?${q.toString()}`;
    return this.#required('upsert access policy', path, {
      method: 'POST',
      body: {
        name: input.name,
        displayName: input.name,
        scopes: input.scopes,
        realms: [
          {
            type: 'stack',
            identifier: String(input.stackId),
            labelPolicies: [],
          },
        ],
      },
    });
  }

  async listTokens(
    region: string,
    accessPolicyId: string
  ): Promise<readonly GrafanaToken[]> {
    const q = new URLSearchParams({ region, accessPolicyId });
    const body = await this.#required<Items<GrafanaToken>>(
      'list tokens',
      `/v1/tokens?${q.toString()}`
    );
    return body.items ?? [];
  }

  async deleteToken(region: string, tokenId: string): Promise<void> {
    const q = new URLSearchParams({ region });
    await this.#request(
      'delete token',
      `/v1/tokens/${encodeURIComponent(tokenId)}?${q.toString()}`,
      { method: 'DELETE' }
    );
  }

  async createToken(input: {
    readonly region: string;
    readonly accessPolicyId: string;
    readonly name: string;
  }): Promise<string> {
    const q = new URLSearchParams({ region: input.region });
    const body = await this.#required<{ readonly token?: string }>(
      'create token',
      `/v1/tokens?${q.toString()}`,
      {
        method: 'POST',
        body: {
          accessPolicyId: input.accessPolicyId,
          name: input.name,
          displayName: input.name,
        },
      }
    );
    const token = body.token?.trim() ?? '';
    if (token.length === 0) throw new Error('Grafana Cloud returned no token');
    return token;
  }
}
