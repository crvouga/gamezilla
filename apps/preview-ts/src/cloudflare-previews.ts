/**
 * The few Cloudflare API calls `wrangler preview` has no command for: the
 * account's workers.dev subdomain (the Preview URL is known before the client
 * bundle is built), whether a Preview still exists (cleanup is verified, not
 * assumed), and which Previews exist (orphans are found, not guessed).
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
};

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

type Got = { readonly status: number; readonly body: Envelope };
type Call = (method: string, path: string) => Promise<Got>;

function caller(send: HttpFetch, apiToken: string): Call {
  return async (method, path) => {
    const response = await send(`${API}${path}`, {
      method,
      headers: { authorization: `Bearer ${apiToken}` },
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
