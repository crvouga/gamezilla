/**
 * A pull request's static site, deployed to its Cloudflare Worker Preview by
 * `@crvouga/mockingbird-preview`: it reads the pull request before the upload
 * and again before the deployment, so a closed pull request or a newer head
 * is never overwritten, sends only the files Cloudflare lacks, and leaves an
 * identical deployment alone. `wrangler deploy` still deploys the Worker
 * itself.
 */

import {
  createCloudflarePreviews,
  type PullRequestFacts,
} from '@crvouga/mockingbird-preview';
import type { HttpFetch } from '@pkgs/http-client-shared-ts/types';

/** The file that sets the site's response headers; never one of its assets. */
const HEADERS_PATH = '/_headers';
/** Files that configure the site and are never served as one of its assets. */
const NOT_ASSETS: ReadonlySet<string> = new Set([
  HEADERS_PATH,
  '/_redirects',
  '/.assetsignore',
]);

export type SiteFile = {
  /** Where the site serves it: `/index.html`, `/assets/app.js`. */
  readonly path: string;
  readonly bytes: Uint8Array<ArrayBuffer>;
  /** What it is served as. */
  readonly contentType: string;
};

/** The `[assets]` settings a deployment carries. */
export type SiteAssets = {
  readonly html_handling?:
    | 'auto-trailing-slash'
    | 'force-trailing-slash'
    | 'drop-trailing-slash'
    | 'none';
  readonly not_found_handling?: 'none' | '404-page' | 'single-page-application';
};

export type PreviewDeploy = {
  readonly accountId: string;
  readonly apiToken: string;
  readonly workerName: string;
  /** The Preview's name: `pr-<number>`. */
  readonly previewName: string;
  /** Every file of the built site, its `_headers` among them. */
  readonly files: readonly SiteFile[];
  readonly assets: SiteAssets;
  readonly compatibilityDate: string;
  readonly commit: string;
  /** The pull request as it is now; read before and after the upload. */
  currentPullRequest(): Promise<PullRequestFacts>;
  readonly fetch: HttpFetch;
};

export type Deployed =
  /** The addresses Cloudflare serves the Preview at. */
  | { readonly kind: 'deployed'; readonly urls: readonly string[] }
  /**
   * The pull request moved on while this run worked: it closed (`remove`,
   * the Preview is deleted) or has a newer head (`skip`).
   */
  | { readonly kind: 'superseded'; readonly action: 'remove' | 'skip' };

/**
 * The deployment API refuses a `_headers` file whose type is anything but
 * `text/plain`, exactly, and Bun's form encoder sends `text/plain;charset=utf-8`
 * for the `File` mockingbird builds. The deployment form is all text (its
 * metadata and `_headers`), so it is encoded here and the one type put back.
 * Workaround for https://github.com/crvouga-organization/mockingbird/issues/843;
 * remove it with the release that fixes that.
 */
export function exactHeadersType(send: HttpFetch): HttpFetch {
  return async (input, init) => {
    if (!(init?.body instanceof FormData)) return await send(input, init);
    const encoded = new Response(init.body);
    const headers = new Headers(init.headers);
    headers.set('content-type', encoded.headers.get('content-type') ?? '');
    const body = (await encoded.text()).replace(
      /(filename="_headers"\r\nContent-Type: )text\/plain;charset=utf-8\r\n/,
      '$1text/plain\r\n'
    );
    return await send(input, { ...init, headers, body });
  };
}

/** Deploy the site to its Preview, unless the pull request moved on. */
export async function deployPreview(args: PreviewDeploy): Promise<Deployed> {
  const headers = args.files.find((file) => file.path === HEADERS_PATH);
  const previews = createCloudflarePreviews({
    accountId: args.accountId,
    workerName: args.workerName,
    token: args.apiToken,
    fetch: exactHeadersType(args.fetch),
  });
  const result = await previews.deploy({
    name: args.previewName,
    commit: args.commit,
    files: args.files.filter((file) => !NOT_ASSETS.has(file.path)),
    currentPullRequest: () => args.currentPullRequest(),
    compatibilityDate: args.compatibilityDate,
    ...(headers === undefined
      ? {}
      : { headers: new TextDecoder().decode(headers.bytes) }),
    ...(args.assets.html_handling === undefined
      ? {}
      : { htmlHandling: args.assets.html_handling }),
    ...(args.assets.not_found_handling === undefined
      ? {}
      : { notFoundHandling: args.assets.not_found_handling }),
  });
  if (result.preview === undefined)
    return {
      kind: 'superseded',
      action: result.action === 'remove' ? 'remove' : 'skip',
    };
  return { kind: 'deployed', urls: result.preview.urls };
}
