import { expect, test } from 'bun:test';
import type { PullRequestFacts } from '@crvouga/mockingbird-preview';
import type { HttpFetch } from '@pkgs/http-client-shared-ts/types';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';
import { deployPreview, type SiteFile } from '../src/cloudflare-deploy';

const ACCOUNT = '/client/v4/accounts/acct';
const PREVIEWS = '/workers/workers/site/previews';
const SESSION = 'session-jwt';
const COMMIT = 'a'.repeat(40);

function answer(status: number, result: unknown): Response {
  return new Response(JSON.stringify({ success: status < 300, result }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** Cloudflare, as far as a deploy talks to it. */
function cloudflare(options: {
  /** Paths whose contents Cloudflare already holds. */
  readonly held?: readonly string[];
  readonly preview?: boolean;
}) {
  const held = new Set<string>();
  const state = {
    manifest: {} as Record<string, { hash: string; size: number }>,
    uploaded: [] as { hash: string; type: string; base64: string }[],
    created: [] as string[],
    deleted: [] as string[],
    deployments: [] as {
      id: string;
      metadata: Record<string, unknown>;
      files: Record<string, string>;
    }[],
  };
  let missing = new Set<string>();
  let exists = options.preview !== false;
  const preview = (id: string) => ({
    id,
    name: 'pr-7',
    updated_on: '2026-11-21T00:00:00Z',
    urls: ['https://pr-7.preview.acme.app'],
  });
  const openSession = async (request: Request): Promise<Response> => {
    state.manifest = ((await request.json()) as typeof state).manifest;
    for (const path of options.held ?? [])
      if (state.manifest[path] !== undefined)
        held.add(state.manifest[path].hash);
    missing = new Set(
      Object.values(state.manifest)
        .map((entry) => entry.hash)
        .filter((hash) => !held.has(hash))
    );
    const wanted = [...missing];
    const buckets: string[][] = [];
    for (let at = 0; at < wanted.length; at += 2)
      buckets.push(wanted.slice(at, at + 2));
    return answer(200, { jwt: SESSION, buckets });
  };
  const upload = async (request: Request): Promise<Response> => {
    // Buckets are read off the wire: the parts are base64 text, and what
    // each is served as is its part's own content type.
    for (const part of (await request.text()).matchAll(
      /name="([0-9a-f]{32})"[^\r\n]*\r\nContent-Type: ([^\r\n]*)\r\n\r\n([^\r\n]*)\r\n/g
    )) {
      state.uploaded.push({ hash: part[1]!, type: part[2]!, base64: part[3]! });
      held.add(part[1]!);
      missing.delete(part[1]!);
    }
    return answer(missing.size === 0 ? 201 : 202, {
      jwt: missing.size === 0 ? 'completion' : undefined,
    });
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
    if (path === `${PREVIEWS}/pr-7`) {
      if (request.method === 'DELETE') {
        state.deleted.push('pr-7');
        exists = false;
        return answer(200, null);
      }
      return exists ? answer(200, preview('held')) : answer(404, null);
    }
    if (path === PREVIEWS && request.method === 'POST') {
      const { name } = (await request.json()) as { name: string };
      state.created.push(name);
      exists = true;
      return answer(200, preview('made'));
    }
    if (path.endsWith('/deployments/latest')) return answer(404, null);
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
    if (path === '/workers/assets/upload') {
      expect(bearer).toBe(`Bearer ${SESSION}`);
      expect(searchParams.get('base64')).toBe('true');
      return await upload(request);
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

const OPEN: PullRequestFacts = {
  state: 'open',
  repository: 'acme/app',
  headRepository: 'acme/app',
  head: COMMIT,
};

function deploy(
  fetch: HttpFetch,
  files: readonly SiteFile[] = SITE,
  pullRequest: () => Promise<PullRequestFacts> = async () => OPEN
) {
  return deployPreview({
    accountId: 'acct',
    apiToken: 'api-token',
    workerName: 'site',
    previewName: 'pr-7',
    files,
    assets: { not_found_handling: 'none' },
    compatibilityDate: '2026-09-21',
    commit: COMMIT,
    currentPullRequest: pullRequest,
    fetch,
  });
}

// regression: preview-mockingbird-headers-content-type
test('a first deploy uploads every asset, then deploys the set with its _headers to the pull request’s Preview', async () => {
  const { fetch, state } = cloudflare({});
  expect(await deploy(fetch)).toEqual({
    kind: 'deployed',
    urls: ['https://pr-7.preview.acme.app'],
  });
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
  expect(state.deployments).toHaveLength(1);
  const [deployment] = state.deployments;
  expect(deployment?.id).toBe('held');
  expect(deployment?.metadata).toMatchObject({
    assets: { jwt: 'completion', config: { not_found_handling: 'none' } },
    compatibility_date: '2026-09-21',
    annotations: { 'workers/commit_sha': COMMIT },
  });
  // The response headers configure the site; they are never an asset.
  expect(deployment?.files).toEqual({
    _headers: '/*\n\tCache-Control: no-store\n',
  });
});

test('a pull request with no Preview yet gets one', async () => {
  const { fetch, state } = cloudflare({ preview: false });
  await deploy(fetch);
  expect(state.created).toEqual(['pr-7']);
  expect(state.deployments.map((deployment) => deployment.id)).toEqual([
    'made',
  ]);
});

test('a pull request that moved on during the upload is never deployed over', async () => {
  for (const [now, action] of [
    [{ ...OPEN, head: 'b'.repeat(40) }, 'skip'],
    [{ ...OPEN, state: 'closed' }, 'remove'],
  ] as const) {
    const { fetch, state } = cloudflare({});
    let reads = 0;
    const moved = async (): Promise<PullRequestFacts> => {
      reads += 1;
      return reads === 1 ? OPEN : now;
    };
    expect(await deploy(fetch, SITE, moved)).toEqual({
      kind: 'superseded',
      action,
    });
    expect(state.deployments).toEqual([]);
    expect(state.deleted).toEqual(action === 'remove' ? ['pr-7'] : []);
  }
});

test('a failed request fails the deploy', async () => {
  const refused: HttpFetch = async () =>
    new Response(
      JSON.stringify({
        success: false,
        errors: [{ code: 10000, message: 'Authentication error' }],
      }),
      { status: 403 }
    );
  await expect(deploy(refused)).rejects.toThrow('HTTP 403');
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
        const held = drawn
          .filter((each) => each.held)
          .map((each) => `/${each.name}`);
        const { fetch, state } = cloudflare({ held });
        await deploy(fetch, files);
        const heldHashes = new Set(
          held.map((path) => state.manifest[path]!.hash)
        );
        const missing = [
          ...new Set(Object.values(state.manifest).map((each) => each.hash)),
        ].filter((hash) => !heldHashes.has(hash));
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
