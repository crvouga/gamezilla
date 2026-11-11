#!/usr/bin/env bun
// @io-wall-ok — preview CLI entry: Cloudflare, GitHub, wrangler and the clock.
/**
 * A pull request's Preview: the web bundle, served as static files from one
 * Cloudflare Worker Preview named `pr-<number>`, with the whole system running
 * in the visitor's browser at `/harness` (docs/PREVIEW_ENVIRONMENTS.md). The
 * same commands run on a laptop (`mise run preview:<command>`) and in the
 * Preview workflow.
 *
 *   preview url                 the Preview URL, read from the pull request
 *   preview build               the harness-only bundle, built for that URL
 *   preview deploy              build, upload, check what is served
 *   preview test                check the deployed Preview over HTTP
 *   preview destroy             delete the Preview, verify it is gone
 *   preview sweep               delete Previews whose pull request is not open
 *   preview ci <plan|build|apply|failed>   the workflow's steps
 *
 * There is no seed, reset or inspect: a Preview has no server and no stored
 * state. What a visitor creates lives in their own browser.
 *
 * The pull request is `PREVIEW_PR`, or the one for the current branch.
 */
import { spawnSync } from 'node:child_process';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { resolveIdentityPlaceholders } from '@libs/product-identity-shared-ts/identity-placeholders';
import { wallClock, wallTimers } from '@pkgs/clock-shared-ts/wall';
import { removeTree } from '@pkgs/fs-server-ts/remove-tree';
import type { HttpFetch } from '@pkgs/http-client-shared-ts/types';
import { distHeadersFile } from '../../product-ts/scripts/dist-headers';
import {
  type CloudflarePreviews,
  createCloudflarePreviews,
} from '../src/cloudflare-previews';
import {
  type PreviewSectionFacts,
  previewUrlInBody,
  renderPreviewSection,
  upsertPreviewSection,
} from '../src/pr-body-section';
import {
  PREVIEW_HARNESS_PATH,
  PREVIEW_MANIFEST_PATH,
  type PreviewCheck,
  type PreviewManifest,
  readPreviewManifest,
  runPreviewChecks,
} from '../src/preview-checks';
import {
  decidePreviewAction,
  PREVIEW_RETENTION_MS,
  type PreviewAction,
  type PreviewTrigger,
  planSweep,
} from '../src/preview-lifecycle';
import {
  isPreviewOriginOf,
  previewNameOfPr,
  previewOrigin,
  prOfPreviewName,
} from '../src/preview-name';

const PACKAGE_DIR = join(import.meta.dirname, '..');
const REPO_ROOT = join(PACKAGE_DIR, '../..');
const PRODUCT_DIR = join(REPO_ROOT, 'apps/product-ts');
const CACHE_DIR = join(PACKAGE_DIR, '.cache');
const WRANGLER = join(PACKAGE_DIR, 'node_modules/.bin/wrangler');
const BUILD_MAX_OLD_SPACE_MB = 8192;
/** One GitHub environment for every Preview; each deployment is transient. */
const GITHUB_ENVIRONMENT = 'preview';
const DEPLOYING_MARK = '🟡 deploying';
function say(message: string): void {
  process.stdout.write(`${message}\n`);
}

function fail(message: string): never {
  process.stderr.write(`preview: ${message}\n`);
  process.exit(1);
}

function envOf(name: string): string | null {
  const value = process.env[name]?.trim();
  return value === undefined || value === '' ? null : value;
}

function run(
  cmd: string,
  args: readonly string[],
  options: {
    readonly cwd?: string;
    readonly env?: NodeJS.ProcessEnv;
    readonly input?: string;
    readonly inherit?: boolean;
  } = {}
): { readonly code: number; readonly stdout: string; readonly stderr: string } {
  const result = spawnSync(cmd, [...args], {
    cwd: options.cwd ?? REPO_ROOT,
    env: options.env ?? process.env,
    input: options.input,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    stdio: options.inherit
      ? ['ignore', 'inherit', 'inherit']
      : [options.input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
  });
  return {
    code: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? result.error?.message ?? '',
  };
}

function must(
  what: string,
  result: ReturnType<typeof run>
): ReturnType<typeof run> {
  if (result.code !== 0)
    throw new Error(
      `${what} exited ${String(result.code)}: ${(result.stderr || result.stdout).trim().slice(-4000)}`
    );
  return result;
}

// ── GitHub ───────────────────────────────────────────────────────────────

function gh(args: readonly string[], input?: string): string {
  return must(
    `gh ${args.slice(0, 3).join(' ')}`,
    run('gh', args, input === undefined ? {} : { input })
  ).stdout;
}

type PullRequest = {
  readonly number: number;
  readonly open: boolean;
  readonly headSha: string;
  readonly body: string;
  readonly fromFork: boolean;
};

function readPullRequest(pr: number | null): PullRequest | null {
  const result = run('gh', [
    'pr',
    'view',
    ...(pr === null ? [] : [String(pr)]),
    '--json',
    'number,state,headRefOid,body,isCrossRepository',
  ]);
  if (result.code !== 0) return null;
  const value = JSON.parse(result.stdout) as {
    number: number;
    state: string;
    headRefOid: string;
    body: string;
    isCrossRepository: boolean;
  };
  return {
    number: value.number,
    open: value.state === 'OPEN',
    headSha: value.headRefOid,
    body: value.body,
    fromFork: value.isCrossRepository,
  };
}

function currentPr(): number {
  const named = envOf('PREVIEW_PR');
  if (named !== null) {
    const pr = Number(named);
    if (!Number.isSafeInteger(pr) || pr <= 0)
      fail(`PREVIEW_PR is not a pull request number: ${named}`);
    return pr;
  }
  const pull = readPullRequest(null);
  if (pull === null)
    fail('no pull request for this branch; set PREVIEW_PR=<number>');
  return pull.number;
}

/** Rewrite only the Preview section; the author's text is returned as read. */
function publishSection(
  pr: number,
  facts: Omit<PreviewSectionFacts, 'pr'>
): void {
  const pull = readPullRequest(pr);
  if (pull === null) return;
  const section = renderPreviewSection({ ...facts, pr });
  const body = upsertPreviewSection(pull.body, section);
  if (body === pull.body) return;
  gh(
    [
      'api',
      '-X',
      'PATCH',
      `repos/{owner}/{repo}/pulls/${String(pr)}`,
      '--input',
      '-',
      '--silent',
    ],
    JSON.stringify({ body })
  );
}

function runUrl(): string | null {
  const server = envOf('GITHUB_SERVER_URL');
  const repo = envOf('GITHUB_REPOSITORY');
  const id = envOf('GITHUB_RUN_ID');
  return server === null || repo === null || id === null
    ? null
    : `${server}/${repo}/actions/runs/${id}`;
}

type DeploymentState = 'in_progress' | 'success' | 'failure' | 'inactive';

/** GitHub deployments are published from CI only; a laptop deploy has no run. */
function createDeployment(pr: number, sha: string): number | null {
  if (envOf('GITHUB_ACTIONS') === null) return null;
  const result = run(
    'gh',
    ['api', 'repos/{owner}/{repo}/deployments', '--input', '-'],
    {
      input: JSON.stringify({
        ref: sha,
        environment: GITHUB_ENVIRONMENT,
        transient_environment: true,
        production_environment: false,
        auto_merge: false,
        required_contexts: [],
        description: previewNameOfPr(pr),
        payload: { pr },
      }),
    }
  );
  if (result.code !== 0) {
    say(`warning: GitHub deployment not created: ${result.stderr.trim()}`);
    return null;
  }
  return (JSON.parse(result.stdout) as { id: number }).id;
}

function deploymentStatus(
  id: number | null,
  state: DeploymentState,
  detail: { readonly url?: string; readonly description?: string } = {}
): void {
  if (id === null) return;
  const result = run(
    'gh',
    [
      'api',
      `repos/{owner}/{repo}/deployments/${String(id)}/statuses`,
      '--input',
      '-',
      '--silent',
    ],
    {
      input: JSON.stringify({
        state,
        auto_inactive: false,
        ...(detail.url === undefined ? {} : { environment_url: detail.url }),
        ...(runUrl() === null ? {} : { log_url: runUrl() }),
        description: (detail.description ?? '').slice(0, 140),
      }),
    }
  );
  if (result.code !== 0)
    say(
      `warning: GitHub deployment status not published: ${result.stderr.trim()}`
    );
}

function deactivateDeployments(pr: number): void {
  if (envOf('GITHUB_ACTIONS') === null) return;
  const result = run('gh', [
    'api',
    `repos/{owner}/{repo}/deployments?environment=${GITHUB_ENVIRONMENT}&per_page=100`,
  ]);
  if (result.code !== 0) return;
  const deployments = JSON.parse(result.stdout) as readonly {
    readonly id: number;
    readonly payload?: { readonly pr?: number } | string;
  }[];
  for (const deployment of deployments) {
    const payload = deployment.payload;
    if (typeof payload === 'object' && payload.pr === pr)
      deploymentStatus(deployment.id, 'inactive', {
        description: 'Preview removed',
      });
  }
}

// ── Cloudflare ───────────────────────────────────────────────────────────

type Wrangler = Record<string, unknown>;

function committedConfig(): Wrangler {
  return resolveIdentityPlaceholders(
    Bun.TOML.parse(
      readFileSync(join(PACKAGE_DIR, 'wrangler.toml'), 'utf8')
    ) as Wrangler
  );
}

function workerName(): string {
  const name = committedConfig()['name'];
  if (typeof name !== 'string') fail('wrangler.toml has no name');
  return name;
}

type Account = {
  readonly accountId: string;
  readonly apiToken: string;
  readonly previews: CloudflarePreviews;
};

function account(): Account {
  const accountId = envOf('CLOUDFLARE_ACCOUNT_ID');
  const apiToken = envOf('CLOUDFLARE_API_TOKEN');
  if (accountId === null || apiToken === null)
    fail(
      'CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN are required (run through `mise run preview:<command>`, which injects the dev secrets)'
    );
  return {
    accountId,
    apiToken,
    previews: createCloudflarePreviews({
      accountId,
      apiToken,
      workerName: workerName(),
      fetch,
    }),
  };
}

/** The Preview URL, known before anything is built or uploaded. */
async function originOf(
  pr: number,
  cloudflare: Account | null
): Promise<string> {
  const given = envOf('PREVIEW_URL');
  if (given !== null) return new URL(given).origin;
  const subdomain =
    envOf('PREVIEW_WORKERS_SUBDOMAIN') ??
    (await (cloudflare ?? account()).previews.subdomain());
  return previewOrigin({
    previewName: previewNameOfPr(pr),
    workerName: workerName(),
    subdomain,
  });
}

function wrangler(
  cloudflare: Account,
  args: readonly string[]
): ReturnType<typeof run> {
  return run(WRANGLER, args, {
    cwd: PACKAGE_DIR,
    env: {
      ...process.env,
      CLOUDFLARE_ACCOUNT_ID: cloudflare.accountId,
      CLOUDFLARE_API_TOKEN: cloudflare.apiToken,
      WRANGLER_SEND_METRICS: 'false',
      CI: 'true',
    },
  });
}

/** A path relative to the package, seen from `.cache/` below it. */
function reRoot(path: unknown): unknown {
  if (typeof path !== 'string' || path.startsWith('/')) return path;
  return `../${path.replace(/^\.\//, '')}`;
}

/** `wrangler.toml` with the identity resolved, as wrangler reads it. */
function writeConfig(): string {
  const committed = committedConfig();
  const assets = committed['assets'] as Wrangler;
  mkdirSync(CACHE_DIR, { recursive: true });
  const path = join(CACHE_DIR, 'preview.wrangler.json');
  writeFileSync(
    path,
    JSON.stringify(
      {
        ...committed,
        assets: { ...assets, directory: reRoot(assets['directory']) },
      },
      null,
      2
    )
  );
  return path;
}

// ── Commands ─────────────────────────────────────────────────────────────

function headCommit(): { readonly sha: string; readonly date: string } {
  const git = (args: readonly string[]) =>
    must(`git ${args.join(' ')}`, run('git', args)).stdout.trim();
  return {
    sha: git(['rev-parse', 'HEAD']),
    date: git(['log', '-1', '--format=%cI', 'HEAD']),
  };
}

/**
 * The harness-only web bundle. It is built for the Preview's own origin so
 * nothing in it names another deployment, and it carries no secret: every
 * value baked into it is public.
 */
async function build(pr: number, origin: string): Promise<void> {
  const commit = headCommit();
  const env = {
    ...process.env,
    // The client build needs more heap than Node's default.
    NODE_OPTIONS:
      envOf('NODE_OPTIONS') ??
      `--max-old-space-size=${String(BUILD_MAX_OLD_SPACE_MB)}`,
    VITE_API_URL: origin,
    VITE_HARNESS_ONLY: '1',
    VITE_COMMIT_HASH: commit.sha,
    VITE_COMMIT_DATE: commit.date,
  };
  const step = (label: string, args: readonly string[]): void => {
    say(`▸ ${label}`);
    const result = run('bun', args, { cwd: PRODUCT_DIR, env, inherit: true });
    if (result.code !== 0) throw new Error(`${label} failed`);
  };
  removeTree(join(PRODUCT_DIR, 'dist'));
  step('web client: build environment gate', [
    'run',
    'verify:live-env',
    '--',
    `--expected-origin=${origin}`,
  ]);
  step('web client: Vite build', ['run', 'build']);
  const dist = join(PRODUCT_DIR, 'dist');
  const manifest: PreviewManifest = {
    preview: previewNameOfPr(pr),
    commit: commit.sha,
  };
  writeFileSync(
    join(dist, PREVIEW_MANIFEST_PATH.slice(1)),
    `${JSON.stringify(manifest)}\n`,
    'utf8'
  );
  const files = readdirSync(dist, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) =>
      join(entry.parentPath, entry.name)
        .slice(dist.length + 1)
        .replaceAll('\\', '/')
    );
  writeFileSync(join(dist, '_headers'), distHeadersFile(files), 'utf8');
  step('web client: built API origin gate', [
    'run',
    'verify:live-dist',
    '--',
    `--expected-origin=${origin}`,
  ]);
  await gate(pr, commit.sha);
}

async function sleep(ms: number): Promise<void> {
  await new Promise<void>((resolve) => {
    wallTimers.setTimeout(resolve, ms);
  });
}

async function serving(origin: string, sha: string): Promise<boolean> {
  const deadline = wallClock.now() + 120_000;
  while (wallClock.now() < deadline) {
    // DNS and the edge take a moment after a first upload.
    if ((await deployedCommit(origin)) === sha) return true;
    await sleep(3000);
  }
  return false;
}

async function deployedCommit(origin: string): Promise<string | null> {
  return (await readPreviewManifest(origin, fetch))?.commit ?? null;
}

function printChecks(checks: readonly PreviewCheck[]): boolean {
  for (const check of checks)
    say(`${check.ok ? '✓' : '✗'} ${check.name} — ${check.detail}`);
  return checks.every((check) => check.ok);
}

function failed(checks: readonly PreviewCheck[]): string {
  return checks
    .filter((check) => !check.ok)
    .map((check) => `${check.name}: ${check.detail}`)
    .join('; ');
}

/** `fetch` over the built bundle on disk, with the fallback Cloudflare applies. */
function bundleFetch(dist: string): HttpFetch {
  const types: Readonly<Record<string, string>> = {
    html: 'text/html; charset=utf-8',
    js: 'text/javascript; charset=utf-8',
    json: 'application/json',
  };
  return async (input) => {
    const path = new URL(new Request(input).url).pathname;
    const file = join(dist, path);
    const found = path !== '/' && existsSync(file) && statSync(file).isFile();
    const served = found ? file : join(dist, 'index.html');
    if (!existsSync(served)) return new Response('', { status: 404 });
    return new Response(readFileSync(served), {
      headers: {
        'content-type':
          types[served.slice(served.lastIndexOf('.') + 1)] ??
          'application/octet-stream',
      },
    });
  };
}

/**
 * The gate before an upload: the bundle on disk passes the same checks the
 * deployed Preview must. A commit that fails here is never uploaded, so the
 * Preview keeps serving its last working one.
 */
async function gate(pr: number, sha: string): Promise<void> {
  say('▸ gate: the built bundle passes the Preview checks before upload');
  const checks = await runPreviewChecks({
    origin: 'https://bundle.invalid',
    fetch: bundleFetch(join(PRODUCT_DIR, 'dist')),
    previewName: previewNameOfPr(pr),
    commit: sha,
  });
  if (!printChecks(checks))
    throw new Error(`the bundle failed its gate — ${failed(checks)}`);
}

class UnhealthyPreview extends Error {}

/** Upload one commit to the pull request's Preview and prove it serves. */
async function upload(
  cloudflare: Account,
  pr: number,
  origin: string,
  sha: string
): Promise<void> {
  const name = previewNameOfPr(pr);
  say(`▸ wrangler preview --name ${name}`);
  const result = must(
    'wrangler preview',
    wrangler(cloudflare, [
      'preview',
      '--name',
      name,
      '--config',
      writeConfig(),
      '--tag',
      sha.slice(0, 12),
      '--message',
      `PR #${String(pr)} at ${sha.slice(0, 12)}`,
      '--json',
    ])
  );
  const urls = previewUrls(result.stdout);
  if (!urls.includes(origin))
    throw new Error(
      `Cloudflare serves the Preview at ${urls.join(', ') || 'no URL'}, but it was built for ${origin}`
    );
  say(`▸ waiting for ${origin} to serve ${sha.slice(0, 12)}`);
  if (!(await serving(origin, sha)))
    throw new UnhealthyPreview(
      `${origin} did not serve ${sha.slice(0, 12)} within two minutes`
    );
  const checks = await runPreviewChecks({
    origin,
    fetch,
    previewName: name,
    commit: sha,
  });
  if (!printChecks(checks)) throw new UnhealthyPreview(failed(checks));
}

/** `wrangler preview --json` prints `{ preview: { urls }, deployment }`. */
function previewUrls(stdout: string): readonly string[] {
  const start = stdout.indexOf('{');
  if (start === -1) return [];
  try {
    const value = JSON.parse(stdout.slice(start)) as {
      preview?: { urls?: readonly string[] };
    };
    return (value.preview?.urls ?? []).map((url) => new URL(url).origin);
  } catch {
    return [];
  }
}

/**
 * Where the pull request's Preview is, for a command that only reads it: the
 * URL its description names (a laptop's identity can differ from the
 * deploy's), accepted only when it has the shape of this pull request's
 * Preview on workers.dev.
 */
function namedOrigin(pr: number): string {
  const named =
    envOf('PREVIEW_URL') ?? previewUrlInBody(readPullRequest(pr)?.body ?? '');
  if (named === null) fail('the pull request names no Preview URL yet');
  const subdomain = /^[^.]+\.([^.]+)\.workers\.dev$/.exec(
    URL.canParse(named) ? new URL(named).hostname : ''
  )?.[1];
  if (
    subdomain === undefined ||
    !isPreviewOriginOf({
      origin: named,
      previewName: previewNameOfPr(pr),
      subdomain,
    })
  )
    fail(
      `${named} is not a Preview URL of pull request #${String(pr)} on workers.dev`
    );
  return new URL(named).origin;
}

async function deploy(pr: number, deploymentSha: string | null): Promise<void> {
  const cloudflare = account();
  const origin = await originOf(pr, cloudflare);
  const sha = deploymentSha ?? headCommit().sha;
  const facts = { url: origin, attemptedSha: sha, runUrl: runUrl() };
  const before = await deployedCommit(origin);
  const deployment = createDeployment(pr, sha);
  deploymentStatus(deployment, 'in_progress', { url: origin });
  try {
    await gate(pr, sha);
    await upload(cloudflare, pr, origin, sha);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const unhealthy = error instanceof UnhealthyPreview;
    deploymentStatus(deployment, 'failure', {
      url: origin,
      description: detail,
    });
    publishSection(pr, {
      ...facts,
      status: unhealthy ? 'unhealthy' : 'failed',
      deployedSha: unhealthy ? await deployedCommit(origin) : before,
      detail: detail.replaceAll('\n', ' ').slice(0, 600),
    });
    throw error;
  }
  deploymentStatus(deployment, 'success', {
    url: `${origin}${PREVIEW_HARNESS_PATH}`,
    description: `${previewNameOfPr(pr)} serves ${sha.slice(0, 12)}`,
  });
  publishSection(pr, {
    ...facts,
    status: 'live',
    deployedSha: sha,
    detail: null,
  });
  say(`✓ ${origin}${PREVIEW_HARNESS_PATH} serves ${sha.slice(0, 12)}`);
}

/**
 * Remove a Preview. It is files only — no Durable Object, database, bucket or
 * secret was ever allocated for it — so deleting the Preview deletes all of
 * it, and only a Preview Cloudflare reports gone counts as removed. What
 * visitors created lives in their own browsers and was never on Cloudflare.
 */
async function destroy(
  cloudflare: Account,
  pr: number,
  status: 'removed' | 'expired'
): Promise<void> {
  const name = previewNameOfPr(pr);
  if ((await cloudflare.previews.preview(name)) === null) {
    say(`✓ ${name}: no such Preview (already removed)`);
  } else {
    await cloudflare.previews.remove(name);
    let gone = false;
    for (let attempt = 0; attempt < 10 && !gone; attempt += 1) {
      gone = (await cloudflare.previews.preview(name)) === null;
      if (!gone) await sleep(2000);
    }
    if (!gone)
      throw new Error(
        `${name}: Cloudflare still reports the Preview after delete`
      );
    say(`✓ ${name}: Preview deleted and confirmed gone`);
  }
  deactivateDeployments(pr);
  publishSection(pr, {
    status,
    url: null,
    deployedSha: null,
    attemptedSha: null,
    runUrl: runUrl(),
    detail: null,
  });
}

type Listed = { readonly number: number; readonly updatedAt: string };

function listPullRequests(
  state: 'open' | 'closed',
  limit: number
): readonly Listed[] {
  return JSON.parse(
    gh([
      'pr',
      'list',
      '--state',
      state,
      '--limit',
      String(limit),
      '--json',
      'number,updatedAt',
    ])
  ) as readonly Listed[];
}

async function sweep(): Promise<void> {
  const cloudflare = account();
  const open = listPullRequests('open', 1000);
  let names = await cloudflare.previews.names();
  if (names === null) {
    // Cloudflare would not list: ask about each recently closed pull request.
    say(
      'Cloudflare did not list Previews; probing recently closed pull requests'
    );
    const found: string[] = [];
    for (const pull of [...listPullRequests('closed', 200), ...open]) {
      const name = previewNameOfPr(pull.number);
      if ((await cloudflare.previews.preview(name)) !== null) found.push(name);
    }
    names = found;
  }
  const plan = planSweep({
    previewNames: names,
    open: open.map((pull) => ({
      pr: pull.number,
      updatedAtMs: Date.parse(pull.updatedAt),
    })),
    nowMs: wallClock.now(),
    retentionMs: PREVIEW_RETENTION_MS,
  });
  say(
    `${String(names.length)} Preview(s); ${String(plan.orphaned.length)} orphaned, ${String(plan.expired.length)} expired`
  );
  const failures: string[] = [];
  for (const [status, list] of [
    ['removed', plan.orphaned],
    ['expired', plan.expired],
  ] as const) {
    for (const name of list) {
      const pr = prOfPreviewName(name);
      if (pr === null) continue;
      try {
        await destroy(cloudflare, pr, status);
      } catch (error) {
        failures.push(
          `${name}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }
  if (failures.length > 0)
    fail(`sweep left Previews behind — ${failures.join('; ')}`);
}

// ── The workflow's steps ─────────────────────────────────────────────────

function output(values: Readonly<Record<string, string>>): void {
  const file = envOf('GITHUB_OUTPUT');
  for (const [key, value] of Object.entries(values)) {
    say(`${key}=${value}`);
    if (file !== null) appendFileSync(file, `${key}=${value}\n`);
  }
}

function trigger(): PreviewTrigger {
  const event = envOf('GITHUB_EVENT_NAME');
  if (event !== 'pull_request') return { kind: 'sweep' };
  const path = envOf('GITHUB_EVENT_PATH');
  if (path === null) fail('GITHUB_EVENT_PATH is not set');
  const payload = JSON.parse(readFileSync(path, 'utf8')) as {
    action: string;
    number: number;
    pull_request: {
      head: { sha: string; repo: { full_name: string } | null };
      base: { repo: { full_name: string } };
    };
  };
  return {
    kind: 'pull-request',
    action: payload.action,
    pr: payload.number,
    sha: payload.pull_request.head.sha,
    fromFork:
      payload.pull_request.head.repo?.full_name !==
      payload.pull_request.base.repo.full_name,
  };
}

function plan(): PreviewAction {
  const from = trigger();
  if (from.kind === 'sweep') return { kind: 'sweep' };
  const pull = readPullRequest(from.pr);
  return decidePreviewAction(
    from,
    pull === null ? null : { open: pull.open, headSha: pull.headSha }
  );
}

async function ci(step: string | undefined): Promise<void> {
  if (step === 'plan') {
    const action = plan();
    if (action.kind === 'skip') say(`skip: ${action.reason}`);
    const origin =
      action.kind === 'deploy' ? await originOf(action.pr, account()) : '';
    output({
      action: action.kind,
      pr: 'pr' in action ? String(action.pr) : '',
      url: origin,
    });
    if (action.kind === 'deploy')
      publishSection(action.pr, {
        status: 'deploying',
        url: origin,
        deployedSha: await deployedCommit(origin),
        attemptedSha: action.sha,
        runUrl: runUrl(),
        detail: null,
      });
    return;
  }
  const action = envOf('PREVIEW_ACTION');
  const pr = Number(envOf('PREVIEW_PR') ?? '0');
  if (step === 'build') {
    await build(pr, await originOf(pr, null));
    return;
  }
  if (step === 'apply') {
    if (action === 'deploy') {
      // The plan was made before the build; the head may have moved since.
      const now = plan();
      if (now.kind !== 'deploy') {
        say(
          `skip: ${now.kind === 'skip' ? now.reason : `pull request now needs ${now.kind}`}`
        );
        if (now.kind === 'destroy') await destroy(account(), now.pr, 'removed');
        return;
      }
      await deploy(now.pr, now.sha);
    } else if (action === 'destroy') await destroy(account(), pr, 'removed');
    else if (action === 'sweep') await sweep();
    return;
  }
  if (step === 'failed') {
    // A step before the upload failed (install, build): say so on the PR.
    if (action !== 'deploy') return;
    const pull = readPullRequest(pr);
    // `deploy` publishes its own outcome; only an unfinished one is ours.
    if (pull === null || !pull.body.includes(DEPLOYING_MARK)) return;
    const origin = previewUrlInBody(pull.body) ?? (await originOf(pr, null));
    publishSection(pr, {
      status: 'failed',
      url: origin,
      deployedSha: await deployedCommit(origin),
      attemptedSha: envOf('GITHUB_SHA'),
      runUrl: runUrl(),
      detail:
        'The run failed before anything was uploaded; see the deploy run.',
    });
    return;
  }
  fail(`unknown ci step: ${String(step)}`);
}

const [command, argument] = process.argv.slice(2);
try {
  switch (command) {
    case 'url': {
      const pull = readPullRequest(currentPr());
      const url = pull === null ? null : previewUrlInBody(pull.body);
      if (url === null) fail('the pull request names no Preview URL yet');
      say(url);
      break;
    }
    case 'build': {
      const pr = currentPr();
      await build(pr, await originOf(pr, null));
      break;
    }
    case 'deploy': {
      const pr = currentPr();
      await build(pr, await originOf(pr, null));
      await deploy(pr, null);
      break;
    }
    case 'test': {
      const pr = currentPr();
      const origin = namedOrigin(pr);
      say(`▸ checking ${origin}`);
      const ok = printChecks(
        await runPreviewChecks({
          origin,
          fetch,
          previewName: previewNameOfPr(pr),
          commit: null,
        })
      );
      if (!ok) process.exit(1);
      break;
    }
    case 'destroy':
      await destroy(account(), currentPr(), 'removed');
      break;
    case 'sweep':
      await sweep();
      break;
    case 'ci':
      await ci(argument);
      break;
    default:
      fail('usage: preview <url|build|deploy|test|destroy|sweep|ci>');
  }
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
