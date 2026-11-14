/**
 * The Cloudflare API calls around a Preview that are not its deploy
 * (`cloudflare-deploy.ts`): the account's workers.dev subdomain (the Preview
 * URL is known before anything is uploaded), whether a Preview still exists
 * (cleanup is verified, not assumed), and which Previews exist (orphans are
 * found, not guessed).
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
  readonly result_info?: {
    readonly cursor?: string;
    readonly total_pages?: number;
  };
};

export type CloudflarePreviews = {
  subdomain(): Promise<string>;
  /** `null` when Cloudflare has no such Preview (or no such Worker). */
  preview(name: string): Promise<{ readonly name: string } | null>;
  /** Every Preview of the Worker; `null` when Cloudflare cannot list them. */
  names(): Promise<readonly string[] | null>;
  /** Deleting a Preview that is already gone succeeds. */
  remove(name: string): Promise<void>;
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

function namesOn(page: readonly unknown[]): string[] {
  return page.flatMap((item) => {
    const name = record(item)['name'];
    return typeof name === 'string' ? [name] : [];
  });
}

async function listNames(
  call: Call,
  worker: string
): Promise<readonly string[] | null> {
  const names: string[] = [];
  let cursor = '';
  // 500 Previews is the account cap; ten pages of 100 covers it.
  for (let page = 0; page < 10; page += 1) {
    const after = cursor === '' ? '' : `&cursor=${encodeURIComponent(cursor)}`;
    const got = await call('GET', `${worker}/previews?per_page=100${after}`);
    if (got.status === 404 && page === 0) {
      // No Worker yet means no Previews; anything else 404 is "cannot list".
      const parent = await call('GET', worker);
      return parent.status === 404 ? [] : null;
    }
    if (got.status !== 200 || !Array.isArray(got.body.result)) return null;
    names.push(...namesOn(got.body.result));
    cursor = got.body.result_info?.cursor ?? '';
    if (cursor === '' || got.body.result.length === 0) return names;
  }
  return names;
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
    names: () => listNames(call, worker),
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
    remove: async (name) => {
      const got = await call(
        'DELETE',
        `${worker}/previews/${encodeURIComponent(name)}`
      );
      if (got.status !== 200 && got.status !== 204 && got.status !== 404)
        throw failure(`delete preview ${name}`, got);
    },
  };
}
