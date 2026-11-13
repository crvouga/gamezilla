/**
 * A pull request's static site, deployed to its Cloudflare Worker Preview in
 * as few round trips as the API allows: which files Cloudflare lacks, those
 * files, and the deployment. `wrangler preview` does the same in twice the
 * requests, one after another, behind a second and a half of starting up,
 * on every commit of every pull request; this is the same documented API
 * (Workers static assets "direct upload", and the Previews API) called
 * directly. `wrangler deploy` still deploys the Worker itself.
 */

import { createHash } from 'node:crypto';
import type { HttpFetch } from '@pkgs/http-client-shared-ts/types';

const API = 'https://api.cloudflare.com/client/v4';
/** Files that configure the site and are never served as one of its assets. */
const NOT_ASSETS: ReadonlySet<string> = new Set([
  '/_headers',
  '/_redirects',
  '/.assetsignore',
]);
/** Buckets of files in flight at once, as `wrangler` uploads them. */
const UPLOADS_AT_ONCE = 3;

export type SiteFile = {
  /** Where the site serves it: `/index.html`, `/assets/app.js`. */
  readonly path: string;
  readonly bytes: Uint8Array<ArrayBuffer>;
  /** What it is served as; `null` serves it with no content type. */
  readonly contentType: string | null;
};

export type PreviewDeploy = {
  readonly accountId: string;
  readonly apiToken: string;
  readonly workerName: string;
  /** The Preview's name: `pr-<number>`. */
  readonly previewName: string;
  /** Every file of the built site, its `_headers` among them. */
  readonly files: readonly SiteFile[];
  /** The `[assets]` settings a deployment carries (`not_found_handling`, …). */
  readonly assets: Readonly<Record<string, unknown>>;
  readonly compatibilityDate: string;
  readonly commit: string;
  readonly message: string;
  readonly fetch: HttpFetch;
};

type Envelope = {
  readonly success?: boolean;
  readonly result?: unknown;
  readonly errors?: readonly {
    readonly code?: number;
    readonly message?: string;
  }[];
};
type Got = { readonly status: number; readonly body: Envelope };

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
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

async function send(
  http: HttpFetch,
  token: string,
  request: {
    readonly method: string;
    readonly path: string;
    readonly body?: BodyInit;
    readonly contentType?: string;
  }
): Promise<Got> {
  const response = await http(`${API}${request.path}`, {
    method: request.method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(request.contentType === undefined
        ? {}
        : { 'content-type': request.contentType }),
    },
    ...(request.body === undefined ? {} : { body: request.body }),
  });
  const text = await response.text();
  try {
    return { status: response.status, body: record(JSON.parse(text)) };
  } catch {
    return {
      status: response.status,
      body: { errors: [{ message: text.slice(0, 200) }] },
    };
  }
}

function ok(got: Got): boolean {
  return got.status >= 200 && got.status < 300 && got.body.success !== false;
}

/**
 * What names a file's contents to Cloudflare, which skips any it already
 * holds: 32 hexadecimal characters of the contents and the extension (the
 * same contents under another extension are served as another type).
 */
export function assetHash(file: SiteFile): string {
  const dot = file.path.lastIndexOf('.');
  const extension =
    dot > file.path.lastIndexOf('/') ? file.path.slice(dot + 1) : '';
  return createHash('sha256')
    .update(Buffer.from(file.bytes).toString('base64'))
    .update(extension)
    .digest('hex')
    .slice(0, 32);
}

/** Whether Cloudflare asked for one request per file rather than buckets. */
function oneFilePerRequest(jwt: string): boolean {
  try {
    const payload: unknown = JSON.parse(
      Buffer.from(jwt.split('.')[1] ?? '', 'base64').toString('utf8')
    );
    return record(payload)['wrangler_single_asset_uploads'] === true;
  } catch {
    return false;
  }
}

async function uploadBucket(
  args: PreviewDeploy,
  session: string,
  bucket: readonly (readonly [string, SiteFile])[]
): Promise<string | null> {
  const base = `/accounts/${args.accountId}/workers/assets/upload`;
  /** The completion token, when this request was the one that finished. */
  const sent = async (
    request: Parameters<typeof send>[2]
  ): Promise<string | null> => {
    const got = await send(args.fetch, session, request);
    if (!ok(got)) throw failure('asset upload', got);
    const jwt = record(got.body.result)['jwt'];
    return typeof jwt === 'string' && jwt !== '' ? jwt : null;
  };
  if (oneFilePerRequest(session)) {
    let completion: string | null = null;
    for (const [hash, file] of bucket)
      completion =
        (await sent({
          method: 'POST',
          path: `${base}/${hash}`,
          body: file.bytes,
          contentType: file.contentType ?? 'application/null',
        })) ?? completion;
    return completion;
  }
  const form = new FormData();
  for (const [hash, file] of bucket)
    form.append(
      hash,
      new File([Buffer.from(file.bytes).toString('base64')], hash, {
        // `application/null` is how this API is told "no content type".
        type: file.contentType ?? 'application/null',
      }),
      hash
    );
  return await sent({
    method: 'POST',
    path: `${base}?base64=true`,
    body: form,
  });
}

/**
 * Give Cloudflare every asset it does not hold yet; the token it answers
 * with stands for the whole set in the deployment that follows.
 */
async function uploadAssets(args: PreviewDeploy): Promise<string> {
  const assets = args.files.filter((file) => !NOT_ASSETS.has(file.path));
  const byHash = new Map<string, SiteFile>();
  const manifest: Record<string, { hash: string; size: number }> = {};
  for (const file of assets) {
    const hash = assetHash(file);
    byHash.set(hash, file);
    manifest[file.path] = { hash, size: file.bytes.byteLength };
  }
  const opened = await send(args.fetch, args.apiToken, {
    method: 'POST',
    path: `/accounts/${args.accountId}/workers/scripts/${args.workerName}/assets-upload-session`,
    body: JSON.stringify({ manifest }),
    contentType: 'application/json',
  });
  const session = record(opened.body.result)['jwt'];
  if (!ok(opened) || typeof session !== 'string' || session === '')
    throw failure('asset upload session', opened);
  const wanted = record(opened.body.result)['buckets'];
  const buckets = (Array.isArray(wanted) ? wanted : [])
    .map((bucket: unknown) =>
      (Array.isArray(bucket) ? bucket : []).flatMap((hash: unknown) => {
        const file = typeof hash === 'string' ? byHash.get(hash) : undefined;
        if (typeof hash !== 'string' || file === undefined)
          throw new Error('Cloudflare asked for a file the site does not have');
        return [[hash, file] as const];
      })
    )
    .filter((bucket) => bucket.length > 0);
  // Nothing new: the session's own token already stands for the set.
  if (buckets.length === 0) return session;
  const queue = [...buckets];
  const worker = async (): Promise<string | null> => {
    let completion: string | null = null;
    for (;;) {
      const bucket = queue.shift();
      if (bucket === undefined) return completion;
      completion = (await uploadBucket(args, session, bucket)) ?? completion;
    }
  };
  const completions = await Promise.all(
    Array.from({ length: UPLOADS_AT_ONCE }, worker)
  );
  const completion = completions.find((jwt) => jwt !== null);
  if (completion === undefined || completion === null)
    throw new Error('Cloudflare did not confirm the asset upload');
  return completion;
}

/** The Preview, made when the pull request has none yet. */
async function preview(
  args: PreviewDeploy
): Promise<{ readonly id: string; readonly urls: readonly string[] }> {
  const previews = `/accounts/${args.accountId}/workers/workers/${args.workerName}/previews`;
  const found = await send(args.fetch, args.apiToken, {
    method: 'GET',
    path: `${previews}/${encodeURIComponent(args.previewName)}`,
  });
  const made =
    found.status === 404
      ? await send(args.fetch, args.apiToken, {
          method: 'POST',
          path: previews,
          body: JSON.stringify({ name: args.previewName }),
          contentType: 'application/json',
        })
      : found;
  const id = record(made.body.result)['id'];
  if (!ok(made) || typeof id !== 'string' || id === '')
    throw failure(`preview ${args.previewName}`, made);
  const urls = record(made.body.result)['urls'];
  return {
    id,
    urls: (Array.isArray(urls) ? urls : []).flatMap((url: unknown) =>
      typeof url === 'string' ? [url] : []
    ),
  };
}

/** Deploy the site to its Preview; the addresses Cloudflare serves it at. */
export async function deployPreview(
  args: PreviewDeploy
): Promise<readonly string[]> {
  // Independent of one another, so neither waits for the other.
  const [assets, { id, urls }] = await Promise.all([
    uploadAssets(args),
    preview(args),
  ]);
  const form = new FormData();
  form.set(
    'metadata',
    JSON.stringify({
      assets: { jwt: assets, config: args.assets },
      compatibility_date: args.compatibilityDate,
      annotations: {
        'workers/commit_sha': args.commit,
        'workers/message': args.message,
        'workers/tag': args.commit.slice(0, 12),
      },
    })
  );
  const headers = args.files.find((file) => file.path === '/_headers');
  if (headers !== undefined)
    form.append(
      'files',
      new File([headers.bytes], '_headers', { type: 'text/plain' })
    );
  const deployed = await send(args.fetch, args.apiToken, {
    method: 'POST',
    path: `/accounts/${args.accountId}/workers/workers/${args.workerName}/previews/${encodeURIComponent(id)}/deployments`,
    body: form,
  });
  if (!ok(deployed)) throw failure(`deploy ${args.previewName}`, deployed);
  return urls;
}
