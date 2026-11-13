import { expect, test } from 'bun:test';
import type { HttpFetch } from '@pkgs/http-client-shared-ts/types';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';
import {
  assetHash,
  deployPreview,
  type SiteFile,
} from '../src/cloudflare-deploy';

const ACCOUNT = '/client/v4/accounts/acct';
const SESSION = `h.${Buffer.from('{}').toString('base64')}.s`;
const ONE_BY_ONE = `h.${Buffer.from('{"wrangler_single_asset_uploads":true}').toString('base64')}.s`;

function answer(status: number, result: unknown): Response {
  return new Response(JSON.stringify({ success: status < 300, result }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** The files of a multipart upload: each part's name, type and body. */
function parts(body: string): { hash: string; type: string; base64: string }[] {
  return [
    ...body.matchAll(
      /name="([0-9a-f]{32})"[^\r\n]*\r\nContent-Type: ([^\r\n]*)\r\n\r\n([^\r\n]*)\r\n/g
    ),
  ].map((part) => ({ hash: part[1]!, type: part[2]!, base64: part[3]! }));
}

/** Cloudflare, as far as a deploy talks to it. */
function cloudflare(options: {
  readonly held?: readonly string[];
  readonly preview?: boolean;
  readonly session?: string;
}) {
  const session = options.session ?? SESSION;
  const held = new Set(options.held ?? []);
  const state = {
    manifest: {} as Record<string, { hash: string; size: number }>,
    uploaded: [] as { hash: string; type: string; base64: string }[],
    uploadRequests: 0,
    created: [] as string[],
    deployments: [] as {
      id: string;
      metadata: Record<string, unknown>;
      files: Record<string, string>;
    }[],
  };
  let missing = new Set<string>();
  const done = (hash: string): string | undefined => {
    held.add(hash);
    missing.delete(hash);
    return missing.size === 0 ? 'completion' : undefined;
  };
  const openSession = async (request: Request): Promise<Response> => {
    state.manifest = ((await request.json()) as typeof state).manifest;
    missing = new Set(
      Object.values(state.manifest)
        .map((entry) => entry.hash)
        .filter((hash) => !held.has(hash))
    );
    const wanted = [...missing];
    const buckets: string[][] = [];
    for (let at = 0; at < wanted.length; at += 2)
      buckets.push(wanted.slice(at, at + 2));
    return answer(200, { jwt: session, buckets });
  };
  const upload = async (request: Request, path: string): Promise<Response> => {
    state.uploadRequests += 1;
    // Buckets are read off the wire: the parts are base64 text, and what
    // each is served as is its part's own content type.
    const received =
      path === '/workers/assets/upload'
        ? parts(await request.text())
        : [
            {
              hash: path.slice('/workers/assets/upload/'.length),
              type: request.headers.get('content-type') ?? '',
              base64: Buffer.from(await request.arrayBuffer()).toString(
                'base64'
              ),
            },
          ];
    let jwt: string | undefined;
    for (const part of received) {
      state.uploaded.push(part);
      jwt = done(part.hash) ?? jwt;
    }
    return answer(jwt === undefined ? 202 : 201, { jwt });
  };
  const deployTo = async (request: Request, id: string): Promise<Response> => {
    // The API refuses a `_headers` file of any type but `text/plain`, exactly.
    for (const type of (await request.clone().text()).matchAll(
      /filename="_headers"\r\nContent-Type: ([^\r\n]*)/g
    ))
      if (type[1] !== 'text/plain')
        return new Response(
          JSON.stringify({
            success: false,
            errors: [{ code: 10021, message: `_headers is ${type[1]!}` }],
          }),
          { status: 400 }
        );
    const form = await request.formData();
    const files: Record<string, string> = {};
    for (const file of form.getAll('files'))
      files[(file as File).name] = await (file as File).text();
    state.deployments.push({
      id,
      metadata: JSON.parse(String(form.get('metadata'))) as Record<
        string,
        unknown
      >,
      files,
    });
    return answer(200, { id: 'deployment' });
  };
  const previews = async (
    request: Request,
    path: string
  ): Promise<Response> => {
    if (path === '/workers/workers/site/previews/pr-7')
      return options.preview === false
        ? answer(404, null)
        : answer(200, { id: 'held', urls: ['https://pr-7.preview.acme.app'] });
    if (path === '/workers/workers/site/previews') {
      const { name } = (await request.json()) as { name: string };
      state.created.push(name);
      return answer(200, { id: 'made', urls: [] });
    }
    const deployment =
      /^\/workers\/workers\/site\/previews\/([^/]+)\/deployments$/.exec(path);
    return deployment === null
      ? answer(404, null)
      : await deployTo(request, deployment[1]!);
  };
  const fetch: HttpFetch = async (input, init) => {
    const request = new Request(input, init);
    const { pathname, searchParams } = new URL(request.url);
    const bearer = request.headers.get('authorization');
    const path = pathname.slice(ACCOUNT.length);
    if (path.startsWith('/workers/assets/upload')) {
      expect(bearer).toBe(`Bearer ${session}`);
      if (path === '/workers/assets/upload')
        expect(searchParams.get('base64')).toBe('true');
      return await upload(request, path);
    }
    expect(bearer).toBe('Bearer api-token');
    return path === '/workers/scripts/site/assets-upload-session'
      ? await openSession(request)
      : await previews(request, path);
  };
  return { fetch, state };
}

const text = (path: string, body: string, contentType: string): SiteFile => ({
  path,
  bytes: new TextEncoder().encode(body),
  contentType,
});

const SITE: readonly SiteFile[] = [
  text('/index.html', '<div id="root"></div>', 'text/html;charset=utf-8'),
  text('/assets/app.js', 'export {}', 'text/javascript;charset=utf-8'),
  text('/preview.json', '{}', 'application/json'),
  text('/_headers', '/*\n\tCache-Control: no-store\n', 'text/plain'),
];

function deploy(fetch: HttpFetch, files: readonly SiteFile[] = SITE) {
  return deployPreview({
    accountId: 'acct',
    apiToken: 'api-token',
    workerName: 'site',
    previewName: 'pr-7',
    files,
    assets: { not_found_handling: 'none' },
    compatibilityDate: '2026-09-21',
    commit: 'a'.repeat(40),
    message: 'PR #7',
    fetch,
  });
}

test('a first deploy uploads every file, then deploys the set Cloudflare confirmed to the pull request’s Preview', async () => {
  const { fetch, state } = cloudflare({});
  expect(await deploy(fetch)).toEqual(['https://pr-7.preview.acme.app']);
  expect(Object.keys(state.manifest).toSorted()).toEqual([
    '/assets/app.js',
    '/index.html',
    '/preview.json',
  ]);
  expect(state.manifest['/index.html']?.size).toBe(21);
  expect(state.uploaded.map((file) => file.hash).toSorted()).toEqual(
    Object.values(state.manifest)
      .map((entry) => entry.hash)
      .toSorted()
  );
  const page = state.uploaded.find(
    (file) => file.hash === state.manifest['/index.html']?.hash
  );
  expect(page?.type).toBe('text/html;charset=utf-8');
  expect(Buffer.from(page!.base64, 'base64').toString()).toBe(
    '<div id="root"></div>'
  );
  expect(state.created).toEqual([]);
  expect(state.deployments).toEqual([
    {
      id: 'held',
      metadata: {
        assets: { jwt: 'completion', config: { not_found_handling: 'none' } },
        compatibility_date: '2026-09-21',
        annotations: {
          'workers/commit_sha': 'a'.repeat(40),
          'workers/message': 'PR #7',
          'workers/tag': 'a'.repeat(12),
        },
      },
      // The response headers configure the site; they are never an asset.
      files: { _headers: '/*\n\tCache-Control: no-store\n' },
    },
  ]);
});

test('a pull request with no Preview yet gets one', async () => {
  const { fetch, state } = cloudflare({ preview: false });
  await deploy(fetch);
  expect(state.created).toEqual(['pr-7']);
  expect(state.deployments.map((deployment) => deployment.id)).toEqual([
    'made',
  ]);
});

test('when Cloudflare asks for one file per request, each goes up as itself', async () => {
  const { fetch, state } = cloudflare({ session: ONE_BY_ONE });
  await deploy(fetch);
  expect(state.uploadRequests).toBe(3);
  const page = state.uploaded.find(
    (file) => file.hash === state.manifest['/index.html']?.hash
  );
  expect(page?.type).toBe('text/html;charset=utf-8');
  expect(Buffer.from(page!.base64, 'base64').toString()).toBe(
    '<div id="root"></div>'
  );
  expect(
    (state.deployments[0]?.metadata['assets'] as { jwt: string }).jwt
  ).toBe('completion');
});

test('a failed request fails the deploy with Cloudflare’s reason', async () => {
  const refused: HttpFetch = async () =>
    new Response(
      JSON.stringify({
        success: false,
        errors: [{ code: 10000, message: 'Authentication error' }],
      }),
      { status: 403 }
    );
  await expect(deploy(refused)).rejects.toThrow(
    'HTTP 403 10000 Authentication error'
  );
});

test('the same contents under another extension are another asset', () => {
  const bytes = new TextEncoder().encode('{}');
  const json = assetHash({ path: '/a.json', bytes, contentType: null });
  expect(json).toMatch(/^[0-9a-f]{32}$/);
  expect(assetHash({ path: '/b.json', bytes, contentType: null })).toBe(json);
  expect(assetHash({ path: '/a.js', bytes, contentType: null })).not.toBe(json);
  expect(assetHash({ path: '/dir.v2/a', bytes, contentType: null })).toBe(
    assetHash({ path: '/a', bytes, contentType: null })
  );
});

test('whatever Cloudflare already holds, a deploy uploads exactly the rest, once', async () => {
  const file = fc.record({
    name: fc.stringMatching(/^[a-z]{1,6}\.(js|css|html|mp3)$/),
    bytes: fc.uint8Array({ maxLength: 40 }),
    held: fc.boolean(),
  });
  await assertProperty(
    'only what is missing is uploaded',
    fc.asyncProperty(
      fc.uniqueArray(file, { maxLength: 12, selector: (each) => each.name }),
      async (drawn) => {
        const files = drawn.map((each) => ({
          path: `/${each.name}`,
          bytes: each.bytes,
          contentType: 'application/octet-stream',
        }));
        const held = files
          .filter((_, at) => drawn[at]!.held)
          .map((each) => assetHash(each));
        const { fetch, state } = cloudflare({ held });
        await deploy(fetch, files);
        const all = new Set(files.map((each) => assetHash(each)));
        const missing = [...all].filter((hash) => !held.includes(hash));
        expect(state.uploaded.map((each) => each.hash).toSorted()).toEqual(
          missing.toSorted()
        );
        expect(Object.keys(state.manifest).toSorted()).toEqual(
          files.map((each) => each.path).toSorted()
        );
        // With nothing to upload, the session's token is the confirmation.
        expect(
          (state.deployments[0]?.metadata['assets'] as { jwt: string }).jwt
        ).toBe(missing.length === 0 ? SESSION : 'completion');
      }
    )
  );
});
