/**
 * The Cloudflare API calls around a Preview that `@crvouga/mockingbird-preview`
 * does not make (it deploys, lists and deletes them, `cloudflare-deploy.ts`
 * and the sweep): the account's workers.dev subdomain (the Preview URL is
 * known before anything is uploaded), whether one Preview still exists
 * (cleanup is verified, not assumed), and having a Worker serve its Previews.
 * Requested upstream (one Preview: #850, the subdomain: #851, serving
 * Previews: #852, at https://github.com/crvouga-organization/mockingbird);
 * remove each call here with the release that provides it.
 */

import type { HttpFetch } from '@pkgs/http-client-shared-ts/types';

const API = 'https://api.cloudflare.com/client/v4';

type Envelope = {
  readonly success?: boolean;
  readonly result?: unknown;
  readonly errors?: readonly {
    readonly code?: number;
    readonly message?: string;
  }[];
};

export type CloudflarePreviews = {
  subdomain(): Promise<string>;
  /** `null` when Cloudflare has no such Preview (or no such Worker). */
  preview(name: string): Promise<{ readonly name: string } | null>;
  /**
   * Have the Worker serve its Previews, without deploying it: on workers.dev,
   * and under `host` (its custom domain) when it has one. These are the two
   * settings `wrangler deploy` applies from `preview_urls` and a route's
   * `previews_enabled`; a Worker deployed before it had them serves no
   * Preview until one of the two is on.
   */
  servePreviews(host: string | null): Promise<void>;
};

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

type Got = { readonly status: number; readonly body: Envelope };
type Call = (method: string, path: string, payload?: unknown) => Promise<Got>;

/** The version of the Worker settings API whose subdomain has Previews. */
const SCRIPT_API_DATE = '2025-08-01';

function caller(send: HttpFetch, apiToken: string): Call {
  return async (method, path, payload) => {
    const response = await send(`${API}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${apiToken}`,
        'cloudflare-workers-script-api-date': SCRIPT_API_DATE,
        ...(payload === undefined
          ? {}
          : { 'content-type': 'application/json' }),
      },
      ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
    });
    const text = await response.text();
    let body: Envelope = {};
    try {
      body = record(JSON.parse(text)) as Envelope;
    } catch {
      body = { errors: [{ message: text.slice(0, 200) }] };
    }
    return { status: response.status, body };
  };
}

function failure(what: string, got: Got): Error {
  return new Error(
    `Cloudflare ${what}: HTTP ${String(got.status)} ${(got.body.errors ?? [])
      .map((error) =>
        `${String(error.code ?? '')} ${error.message ?? ''}`.trim()
      )
      .join('; ')}`
  );
}

export function createCloudflarePreviews(args: {
  readonly accountId: string;
  readonly apiToken: string;
  readonly workerName: string;
  readonly fetch: HttpFetch;
}): CloudflarePreviews {
  const worker = `/accounts/${args.accountId}/workers/workers/${args.workerName}`;
  const script = `/accounts/${args.accountId}/workers/scripts/${args.workerName}`;
  const call = caller(args.fetch, args.apiToken);
  return {
    subdomain: async () => {
      const got = await call(
        'GET',
        `/accounts/${args.accountId}/workers/subdomain`
      );
      const subdomain = record(got.body.result)['subdomain'];
      if (
        got.status !== 200 ||
        typeof subdomain !== 'string' ||
        subdomain === ''
      )
        throw failure('workers.dev subdomain', got);
      return subdomain;
    },
    preview: async (name) => {
      const got = await call(
        'GET',
        `${worker}/previews/${encodeURIComponent(name)}`
      );
      if (got.status === 404) return null;
      if (got.status !== 200) throw failure(`preview ${name}`, got);
      return { name };
    },
    servePreviews: async (host) => {
      const before = await call('GET', `${script}/subdomain`);
      if (before.status !== 200) throw failure('worker subdomain', before);
      const subdomain = record(before.body.result);
      if (subdomain['previews_enabled'] !== true) {
        // The Worker's own workers.dev address stays as it is.
        const set = await call('POST', `${script}/subdomain`, {
          enabled: subdomain['enabled'] === true,
          previews_enabled: true,
        });
        if (set.status !== 200) throw failure('enable preview URLs', set);
      }
      if (host === null) return;
      // The hostname is already this Worker's; only its Previews are new.
      const domain = await call('PUT', `${script}/domains/records`, {
        override_scope: true,
        override_existing_origin: true,
        override_existing_dns_record: true,
        origins: [{ hostname: host, previews_enabled: true }],
      });
      if (domain.status !== 200)
        throw failure(`enable Previews on ${host}`, domain);
    },
  };
}
