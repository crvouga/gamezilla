/**
 * What a deployed Preview must be, checked over plain HTTP: the harness page,
 * the bundle it loads, the commit it was built from, and — because a Preview
 * is files and nothing else — no server answering behind it. The pull
 * request's Storybook is a second static site held to the same standard.
 */

import type { HttpFetch } from '@pkgs/http-client-shared-ts/types';

/** Written into the bundle by `preview build`; names what is being served. */
export const PREVIEW_MANIFEST_PATH = '/preview.json';
/**
 * The compiled messages, a module of their own the bundle imports by this
 * address: they are compiled beside the bundle, never into it.
 */
export const MESSAGES_PATH = '/messages.js';
/** The harness is the whole site: it is the page at the root. */
const HARNESS_PATH = '/';
/** An application route with no file behind it. */
const API_PROBE_PATH = '/api/health';

export type PreviewManifest = {
  readonly preview: string;
  readonly commit: string;
};

export type PreviewCheck = {
  readonly name: string;
  readonly ok: boolean;
  readonly detail: string;
};

export function parsePreviewManifest(text: string): PreviewManifest | null {
  try {
    const value: unknown = JSON.parse(text);
    if (value === null || typeof value !== 'object') return null;
    const { preview, commit } = value as Record<string, unknown>;
    return typeof preview === 'string' && typeof commit === 'string'
      ? { preview, commit }
      : null;
  } catch {
    return null;
  }
}

/** The manifest a Preview serves, or `null` when it serves none. */
export async function readPreviewManifest(
  origin: string,
  send: HttpFetch
): Promise<PreviewManifest | null> {
  try {
    const response = await send(`${origin}${PREVIEW_MANIFEST_PATH}`);
    if (!response.ok || !isOf(response, 'application/json')) return null;
    return parsePreviewManifest(await response.text());
  } catch {
    return null;
  }
}

function isOf(response: Response, type: string): boolean {
  return (response.headers.get('content-type') ?? '').includes(type);
}

/** The module scripts an HTML page loads from its own origin. */
export function entryScripts(html: string): readonly string[] {
  return [
    ...html.matchAll(/<script\b[^>]*\bsrc="(\/[^"]+\.js)"[^>]*>/g),
  ].flatMap((match) => (match[1] === undefined ? [] : [match[1]]));
}

type Probe = {
  readonly origin: string;
  readonly fetch: HttpFetch;
};

async function harnessCheck(probe: Probe): Promise<{
  readonly check: PreviewCheck;
  readonly scripts: readonly string[];
}> {
  const response = await probe.fetch(`${probe.origin}${HARNESS_PATH}`);
  const html = await response.text();
  const ok =
    response.status === 200 &&
    isOf(response, 'text/html') &&
    html.includes('id="root"');
  return {
    check: {
      name: 'harness page',
      ok,
      detail: ok
        ? `${HARNESS_PATH} serves the harness shell`
        : `${HARNESS_PATH} answered HTTP ${String(response.status)} ${response.headers.get('content-type') ?? ''}`,
    },
    scripts: entryScripts(html),
  };
}

async function bundleCheck(
  probe: Probe,
  scripts: readonly string[]
): Promise<PreviewCheck> {
  const name = 'bundle';
  if (scripts.length === 0)
    return { name, ok: false, detail: 'the page loads no script' };
  for (const script of [...scripts, MESSAGES_PATH]) {
    const response = await probe.fetch(`${probe.origin}${script}`);
    await response.arrayBuffer();
    if (response.status !== 200 || !isOf(response, 'javascript'))
      return {
        name,
        ok: false,
        detail: `${script} answered HTTP ${String(response.status)} ${response.headers.get('content-type') ?? ''}`,
      };
  }
  return {
    name,
    ok: true,
    detail: `${String(scripts.length)} entry script(s) and the messages served`,
  };
}

async function commitCheck(
  probe: Probe,
  expected: { readonly previewName: string; readonly commit: string | null }
): Promise<PreviewCheck> {
  const name = 'deployed commit';
  const manifest = await readPreviewManifest(probe.origin, probe.fetch);
  if (manifest === null)
    return { name, ok: false, detail: `${PREVIEW_MANIFEST_PATH} is missing` };
  if (manifest.preview !== expected.previewName)
    return {
      name,
      ok: false,
      detail: `serves ${manifest.preview}, expected ${expected.previewName}`,
    };
  if (expected.commit !== null && manifest.commit !== expected.commit)
    return {
      name,
      ok: false,
      detail: `serves ${manifest.commit.slice(0, 12)}, expected ${expected.commit.slice(0, 12)}`,
    };
  return { name, ok: true, detail: manifest.commit.slice(0, 12) };
}

/** A route no file backs is not found: nothing computes an answer for it. */
async function staticOnlyCheck(probe: Probe): Promise<PreviewCheck> {
  const response = await probe.fetch(`${probe.origin}${API_PROBE_PATH}`);
  await response.arrayBuffer();
  const ok = response.status === 404 || isOf(response, 'text/html');
  return {
    name: 'no server',
    ok,
    detail: ok
      ? `${API_PROBE_PATH} is not an API (HTTP ${String(response.status)})`
      : `${API_PROBE_PATH} answered ${response.headers.get('content-type') ?? 'no content type'} (HTTP ${String(response.status)}): something is serving requests`,
  };
}

async function guarded(
  name: string,
  check: () => Promise<PreviewCheck>
): Promise<PreviewCheck> {
  try {
    return await check();
  } catch (error) {
    return {
      name,
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

export type PreviewChecksArgs = {
  readonly origin: string;
  readonly fetch: HttpFetch;
  readonly previewName: string;
  /** `null` accepts whichever commit the Preview names. */
  readonly commit: string | null;
};

export type PreviewChecks = (
  args: PreviewChecksArgs
) => Promise<readonly PreviewCheck[]>;

export async function runPreviewChecks(
  args: PreviewChecksArgs
): Promise<readonly PreviewCheck[]> {
  const probe: Probe = { origin: args.origin, fetch: args.fetch };
  let scripts: readonly string[] = [];
  const harness = await guarded('harness page', async () => {
    const result = await harnessCheck(probe);
    scripts = result.scripts;
    return result.check;
  });
  // Independent of one another once the page has named its scripts.
  return [
    harness,
    ...(await Promise.all([
      guarded('bundle', () => bundleCheck(probe, scripts)),
      guarded('deployed commit', () => commitCheck(probe, args)),
      guarded('no server', () => staticOnlyCheck(probe)),
    ])),
  ];
}

/** Storybook's manager page, the frame stories render in, and its story index. */
const STORYBOOK_MANAGER_PATH = '/';
const STORYBOOK_FRAME_PATH = '/iframe.html';
const STORYBOOK_INDEX_PATH = '/index.json';

async function storybookPageCheck(
  probe: Probe,
  page: {
    readonly name: string;
    readonly path: string;
    readonly marker: string;
  }
): Promise<PreviewCheck> {
  const response = await probe.fetch(`${probe.origin}${page.path}`);
  const html = await response.text();
  const ok =
    response.status === 200 &&
    isOf(response, 'text/html') &&
    html.includes(page.marker);
  return {
    name: page.name,
    ok,
    detail: ok
      ? `${page.path} serves Storybook`
      : `${page.path} answered HTTP ${String(response.status)} ${response.headers.get('content-type') ?? ''}`,
  };
}

/** The number of stories and docs pages in a Storybook `index.json`. */
export function storyCount(text: string): number {
  try {
    const value: unknown = JSON.parse(text);
    if (value === null || typeof value !== 'object') return 0;
    const { entries } = value as Record<string, unknown>;
    return entries !== null && typeof entries === 'object'
      ? Object.keys(entries).length
      : 0;
  } catch {
    return 0;
  }
}

async function storyIndexCheck(probe: Probe): Promise<PreviewCheck> {
  const name = 'story index';
  const response = await probe.fetch(`${probe.origin}${STORYBOOK_INDEX_PATH}`);
  const count = storyCount(await response.text());
  if (response.status !== 200 || count === 0)
    return {
      name,
      ok: false,
      detail: `${STORYBOOK_INDEX_PATH} lists no stories (HTTP ${String(response.status)})`,
    };
  return { name, ok: true, detail: `${String(count)} entries` };
}

/** The checks of a pull request's Storybook site. */
export async function runStorybookChecks(
  args: PreviewChecksArgs
): Promise<readonly PreviewCheck[]> {
  const probe: Probe = { origin: args.origin, fetch: args.fetch };
  const manager = {
    name: 'storybook page',
    path: STORYBOOK_MANAGER_PATH,
    marker: 'id="root"',
  };
  const frame = {
    name: 'story frame',
    path: STORYBOOK_FRAME_PATH,
    marker: 'id="storybook-root"',
  };
  return [
    await guarded(manager.name, () => storybookPageCheck(probe, manager)),
    await guarded(frame.name, () => storybookPageCheck(probe, frame)),
    await guarded('story index', () => storyIndexCheck(probe)),
    await guarded('deployed commit', () => commitCheck(probe, args)),
    await guarded('no server', () => staticOnlyCheck(probe)),
  ];
}
