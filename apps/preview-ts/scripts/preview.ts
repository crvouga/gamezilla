#!/usr/bin/env bun
// @io-wall-ok — preview CLI entry: Cloudflare, GitHub, wrangler and the clock.
/**
 * A pull request's Preview: the web bundle, served as static files from one
 * Cloudflare Worker Preview named `pr-<number>`, with the whole system running
 * in the visitor's browser (docs/PREVIEW_ENVIRONMENTS.md), and beside it the
 * pull request's Storybook, a Preview of the same name on the Storybook
 * site's own Worker (`apps/storybook-ts`), with the same lifecycle. The same commands run on a laptop (`mise run preview:<command>`)
 * and in the Preview workflow.
 *
 *   preview url                 the Preview URL, read from the pull request
 *   preview build               the harness bundle, built for that URL
 *   preview deploy              build, upload, check what is served
 *   preview main                build and deploy this checkout as the main branch's
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
import { spawn, spawnSync } from 'node:child_process';
import {
  appendFileSync,
  cpSync,
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
  type BundleFile,
  billableSettings,
  freePlanCheck,
} from '../src/free-plan';
import {
  type PreviewSectionFacts,
  previewUrlInBody,
  renderPreviewSection,
  storybookUrlInBody,
  upsertPreviewSection,
} from '../src/pr-body-section';
import {
  PREVIEW_MANIFEST_PATH,
  type PreviewCheck,
  type PreviewChecks,
  type PreviewManifest,
  readPreviewManifest,
  runPreviewChecks,
  runStorybookChecks,
} from '../src/preview-checks';
import {
  decideMainAction,
  decidePreviewAction,
  failingChecks,
  PREVIEW_CAPACITY,
  PREVIEW_RETENTION_MS,
  type PreviewAction,
  type PreviewTrigger,
  planSweep,
  uploadsDespiteGate,
} from '../src/preview-lifecycle';
import {
  customPreviewOrigin,
  isPreviewOriginOf,
  MAIN_PREVIEW_NAME,
  previewNameOfPr,
  previewOrigin,
  prOfPreviewName,
} from '../src/preview-name';

const PACKAGE_DIR = join(import.meta.dirname, '..');
const REPO_ROOT = join(PACKAGE_DIR, '../..');
const HARNESS_DIR = join(REPO_ROOT, 'apps/harness-ts');
const HARNESS_DIST = join(HARNESS_DIR, 'dist');
const CACHE_DIR = join(PACKAGE_DIR, '.cache');
/** The canonical Storybook build (`@pkgs/ui-root-harness-ts#storybook:build`). */
const STORYBOOK_BUILD = join(
  REPO_ROOT,
  'pkgs/ui-root-harness-ts/.cache/storybook'
);
const STORYBOOK_DIST = join(CACHE_DIR, 'storybook-site');
const WRANGLER = join(PACKAGE_DIR, 'node_modules/.bin/wrangler');
const TURBO = join(REPO_ROOT, 'node_modules/.bin/turbo');
const BUILD_MAX_OLD_SPACE_MB = 8192;
/** One GitHub environment for every Preview; each deployment is transient. */
const GITHUB_ENVIRONMENT = 'preview';
const DEPLOYING_MARK = '🟡 deploying';

type Wrangler = Record<string, unknown>;

/**
 * A static site a pull request gets: one assets-only Worker, whose Previews
 * are the pull requests' and whose own deployment is the main branch's.
 */
type Site = {
  readonly key: 'harness' | 'storybook';
  /** Its wrangler config, with the identity resolved. */
  config(): Wrangler;
  /** The built files a Preview uploads. */
  readonly dist: string;
  readonly checks: PreviewChecks;
  /**
   * Whether these commands deploy the Worker itself, for the main branch.
   * Storybook's is the released site: the Release workflow deploys it, and
   * nothing here ever replaces it.
   */
  readonly deploysMain: boolean;
};

function tomlOf(path: string): Wrangler {
  return Bun.TOML.parse(readFileSync(path, 'utf8')) as Wrangler;
}

const HARNESS: Site = {
  key: 'harness',
  config: () =>
    resolveIdentityPlaceholders(tomlOf(join(PACKAGE_DIR, 'wrangler.toml'))),
  dist: HARNESS_DIST,
  checks: runPreviewChecks,
  deploysMain: true,
};

/**
 * The Storybook site's Worker and hostname, as the release deploys them
 * (`renderStorybookWranglerConfig`): named in `global.tfvars.json`, with
 * Previews enabled on the hostname. Read from the file rather than through
 * `@libs/infra-shared-ts`, which every edit would otherwise rebuild this for.
 */
function storybookConfig(): Wrangler {
  const global = resolveIdentityPlaceholders(
    JSON.parse(
      readFileSync(
        join(REPO_ROOT, 'libs/infra-shared-ts/tofu/global.tfvars.json'),
        'utf8'
      )
    ) as { storybook: { worker: string; hostname: string } }
  );
  return {
    ...resolveIdentityPlaceholders(
      tomlOf(join(REPO_ROOT, 'apps/storybook-ts/wrangler.toml'))
    ),
    name: global.storybook.worker,
    routes: [
      {
        pattern: global.storybook.hostname,
        custom_domain: true,
        previews_enabled: true,
      },
    ],
  };
}

const STORYBOOK: Site = {
  key: 'storybook',
  config: storybookConfig,
  dist: STORYBOOK_DIST,
  checks: runStorybookChecks,
  deploysMain: false,
};

const SITES: readonly Site[] = [HARNESS, STORYBOOK];

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

/** `run`, without holding the thread: two of these make progress at once. */
async function runAsync(
  cmd: string,
  args: readonly string[],
  options: { readonly cwd?: string; readonly env?: NodeJS.ProcessEnv } = {}
): Promise<ReturnType<typeof run>> {
  return await new Promise((resolve) => {
    const child = spawn(cmd, [...args], {
      cwd: options.cwd ?? REPO_ROOT,
      env: options.env ?? process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', (error) => {
      resolve({ code: 1, stdout, stderr: stderr || error.message });
    });
    child.on('close', (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
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

/**
 * A pull request's GitHub deployments, but for `keep`: marked inactive and
 * deleted. Each commit makes one, so without this a long-lived pull request
 * leaves a record per push behind it, and a closed one leaves them all.
 */
function pruneDeployments(pr: number, keep: number | null): void {
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
    if (typeof payload !== 'object' || payload.pr !== pr) continue;
    if (deployment.id === keep) continue;
    deploymentStatus(deployment.id, 'inactive', {
      description: 'Preview replaced or removed',
    });
    // GitHub deletes only an inactive deployment; one it keeps is harmless.
    run('gh', [
      'api',
      '-X',
      'DELETE',
      `repos/{owner}/{repo}/deployments/${String(deployment.id)}`,
      '--silent',
    ]);
  }
}

// ── Cloudflare ───────────────────────────────────────────────────────────

function workerName(site: Site): string {
  const name = site.config()['name'];
  if (typeof name !== 'string') fail(`the ${site.key} config has no name`);
  return name;
}

/** The custom domain of a site's config (`preview.<domain>`), when it has one. */
function previewHost(site: Site): string | null {
  const routes = site.config()['routes'];
  if (!Array.isArray(routes)) return null;
  for (const route of routes as readonly Wrangler[])
    if (route['custom_domain'] === true && typeof route['pattern'] === 'string')
      return route['pattern'];
  return null;
}

type Account = {
  readonly accountId: string;
  readonly apiToken: string;
  /** The Previews of one site's Worker. */
  previews(site: Site): CloudflarePreviews;
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
    previews: (site) =>
      createCloudflarePreviews({
        accountId,
        apiToken,
        workerName: workerName(site),
        fetch,
      }),
  };
}

/** Whether `origin` answers over HTTPS at all, whatever it answers. */
async function answers(origin: string): Promise<boolean> {
  try {
    const response = await fetch(`${origin}${PREVIEW_MANIFEST_PATH}`);
    await response.arrayBuffer();
    return true;
  } catch {
    return false;
  }
}

const origins = new Map<string, string>();

/**
 * A site's URL for a pull request, known before anything is built or
 * uploaded: on the custom domain when that already answers for this
 * Preview's name, and on workers.dev otherwise -- before the domain is
 * attached, while its certificate is being issued, or if the account cannot
 * serve it. The harness bundle is built for one origin, so the choice is made
 * once per run (`PREVIEW_URL` carries it between the workflow's steps).
 */
async function originOf(
  site: Site,
  pr: number,
  cloudflare: Account | null
): Promise<string> {
  const given = site === HARNESS ? envOf('PREVIEW_URL') : null;
  if (given !== null) return new URL(given).origin;
  const key = `${site.key}:${String(pr)}`;
  const known = origins.get(key);
  if (known !== undefined) return known;
  const origin = await chosenOrigin(site, pr, cloudflare);
  origins.set(key, origin);
  return origin;
}

async function chosenOrigin(
  site: Site,
  pr: number,
  cloudflare: Account | null
): Promise<string> {
  const previewName = previewNameOfPr(pr);
  const host = previewHost(site);
  if (host !== null) {
    const custom = customPreviewOrigin({ previewName, host });
    if (await answers(custom)) return custom;
    say(`${custom} does not answer; using workers.dev`);
  }
  const subdomain =
    envOf('PREVIEW_WORKERS_SUBDOMAIN') ??
    (await (cloudflare ?? account()).previews(site).subdomain());
  return previewOrigin({
    previewName,
    workerName: workerName(site),
    subdomain,
  });
}

function wranglerEnv(cloudflare: Account): NodeJS.ProcessEnv {
  return {
    ...process.env,
    CLOUDFLARE_ACCOUNT_ID: cloudflare.accountId,
    CLOUDFLARE_API_TOKEN: cloudflare.apiToken,
    WRANGLER_SEND_METRICS: 'false',
    CI: 'true',
  };
}

function wrangler(
  cloudflare: Account,
  args: readonly string[]
): ReturnType<typeof run> {
  return run(WRANGLER, args, {
    cwd: PACKAGE_DIR,
    env: wranglerEnv(cloudflare),
  });
}

/** A site's config with the identity resolved, as wrangler reads it. */
function writeConfig(site: Site): string {
  const committed = site.config();
  // Static files are free at any traffic; anything more could be billed.
  const billable = billableSettings(committed);
  if (billable.length > 0)
    throw new Error(
      `the ${site.key} config declares more than static files (${billable.join(', ')}); a Preview must stay free`
    );
  const assets = committed['assets'] as Wrangler;
  mkdirSync(CACHE_DIR, { recursive: true });
  const path = join(CACHE_DIR, `${site.key}.wrangler.json`);
  writeFileSync(
    path,
    JSON.stringify(
      {
        ...committed,
        assets: { ...assets, directory: site.dist },
        previews: committed['previews'] ?? {},
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
 * The harness bundle (`apps/harness-ts`). It is built for the Preview's own
 * origin so nothing in it names another deployment, and it carries no
 * secret: every value baked into it is public.
 */
async function build(previewName: string, origin: string): Promise<void> {
  const commit = headCommit();
  const env = {
    ...process.env,
    // The client build needs more heap than Node's default.
    NODE_OPTIONS:
      envOf('NODE_OPTIONS') ??
      `--max-old-space-size=${String(BUILD_MAX_OLD_SPACE_MB)}`,
    VITE_API_URL: origin,
    VITE_COMMIT_HASH: commit.sha,
    VITE_COMMIT_DATE: commit.date,
  };
  removeTree(HARNESS_DIST);
  say('▸ harness: Vite build');
  const built = run('bun', ['run', 'build'], {
    cwd: HARNESS_DIR,
    env,
    inherit: true,
  });
  if (built.code !== 0) throw new Error('harness: Vite build failed');
  writeManifest(HARNESS, previewName, commit.sha);
  const files = bundleFiles(HARNESS_DIST).map((file) => file.path);
  writeFileSync(join(HARNESS_DIST, '_headers'), distHeadersFile(files), 'utf8');
  // Fatal only for the main branch: a pull request's bundle is uploaded
  // whatever its gate says, so its build step succeeds once a bundle exists.
  await gate(HARNESS, previewName, commit.sha);
}

/** Every file of a built site, by its path in the site. */
function bundleFiles(dist: string): readonly BundleFile[] {
  return readdirSync(dist, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => {
      const file = join(entry.parentPath, entry.name);
      return {
        path: file.slice(dist.length + 1).replaceAll('\\', '/'),
        bytes: statSync(file).size,
      };
    });
}

/** `preview.json` names the Preview and the commit a site was built from. */
function writeManifest(site: Site, previewName: string, sha: string): void {
  const manifest: PreviewManifest = { preview: previewName, commit: sha };
  writeFileSync(
    join(site.dist, PREVIEW_MANIFEST_PATH.slice(1)),
    `${JSON.stringify(manifest)}\n`,
    'utf8'
  );
}

/**
 * The Storybook site: the canonical build, which Turborepo makes or restores
 * from its cache, copied (so the cached output is never written to) with its
 * manifest. It is gated where it is uploaded. It is not built for an origin and nothing in the harness waits
 * for it, so a deploy runs this beside the harness upload: a commit that
 * changes no story restores in seconds, and one that does never holds the
 * Preview back. Turborepo is run as it is: whatever ran this command (the
 * `mise` task, the workflow's setup) already injected the secrets and
 * configured the identity, and doing so again costs seconds of every deploy.
 */
async function buildStorybook(previewName: string, sha: string): Promise<void> {
  say('▸ storybook: canonical build (Turborepo builds or restores it)');
  const built = await runAsync(TURBO, [
    'run',
    '@pkgs/ui-root-harness-ts#storybook:build',
    '--output-logs=errors-only',
  ]);
  if (built.code !== 0 || !existsSync(join(STORYBOOK_BUILD, 'index.html')))
    throw new Error(
      `storybook: build failed: ${(built.stderr || built.stdout).trim().slice(-2000)}`
    );
  removeTree(STORYBOOK_DIST);
  mkdirSync(CACHE_DIR, { recursive: true });
  cpSync(STORYBOOK_BUILD, STORYBOOK_DIST, { recursive: true });
  writeManifest(STORYBOOK, previewName, sha);
}

async function sleep(ms: number): Promise<void> {
  await new Promise<void>((resolve) => {
    wallTimers.setTimeout(resolve, ms);
  });
}

/** Answers in a row that must name the commit before it counts as served. */
const SETTLED_ANSWERS = 3;

/**
 * Whether `origin` has settled on `sha`. Cloudflare's edge moves to a new
 * upload machine by machine, so for a moment after the first answer naming
 * it, another request can still be answered with the one before; only
 * several answers in a row say the checks will read what was uploaded.
 */
async function serving(
  origin: string,
  sha: string,
  withinMs = 120_000
): Promise<boolean> {
  const deadline = wallClock.now() + withinMs;
  let settled = 0;
  while (wallClock.now() < deadline) {
    // DNS and the edge take a moment after a first upload; an upload over
    // an earlier one is usually served within a second or two.
    settled = (await deployedCommit(origin)) === sha ? settled + 1 : 0;
    if (settled >= SETTLED_ANSWERS) return true;
    await sleep(settled === 0 ? 1000 : 500);
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

/** `fetch` over the built bundle on disk, resolved the way Cloudflare does. */
function bundleFetch(dist: string): HttpFetch {
  const types: Readonly<Record<string, string>> = {
    html: 'text/html; charset=utf-8',
    js: 'text/javascript; charset=utf-8',
    json: 'application/json',
  };
  const isFile = (file: string): boolean =>
    existsSync(file) && statSync(file).isFile();
  return async (input) => {
    const path = new URL(new Request(input).url).pathname;
    const served = [
      join(dist, path),
      join(dist, `${path}.html`),
      join(dist, path, 'index.html'),
    ].find(isFile);
    if (served === undefined)
      return new Response('Not found', {
        status: 404,
        headers: { 'content-type': 'text/html' },
      });
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
 * The gate before an upload: a site on disk runs the same checks its
 * deployed Preview must, and must fit the free plan. On the main branch a failure stops the upload, so
 * `preview.<domain>` keeps its last working version. A pull request's
 * Preview is best effort (`uploadsDespiteGate`): the failure is a warning,
 * returned so the deploy can report it, and the bundle goes up anyway.
 */
async function gate(
  site: Site,
  previewName: string,
  sha: string
): Promise<string | null> {
  const checks = [
    ...(await site.checks({
      origin: 'https://bundle.invalid',
      fetch: bundleFetch(site.dist),
      previewName,
      commit: sha,
    })),
    freePlanCheck(bundleFiles(site.dist)),
  ];
  say(`▸ gate: the built ${site.key} runs its checks before upload`);
  if (printChecks(checks)) return null;
  const failures = failed(checks);
  if (!uploadsDespiteGate(previewName))
    throw new Error(`the ${site.key} failed its gate — ${failures}`);
  say(
    `! the ${site.key} failed its gate; uploading it anyway (best effort) — ${failures}`
  );
  return failures;
}

class UnhealthyPreview extends Error {}

/** How long the edge may take to answer every request with one upload. */
const AGREED_WITHIN_MS = 60_000;

/**
 * The checks of a site just uploaded, read from its origin. The upload
 * usually passed them on disk (`gate`), and the edge moves to it machine by
 * machine: a page from the new upload can ask a machine still on the one
 * before for its script, which that machine does not have. So a failure here
 * is read again until the edge agrees, and reported only if it never does.
 */
async function servedChecks(
  site: Site,
  target: {
    readonly origin: string;
    readonly previewName: string;
    readonly commit: string;
  }
): Promise<readonly PreviewCheck[]> {
  const deadline = wallClock.now() + AGREED_WITHIN_MS;
  for (;;) {
    const checks = await site.checks({ ...target, fetch });
    if (checks.every((check) => check.ok) || wallClock.now() >= deadline)
      return checks;
    await sleep(3000);
  }
}

/**
 * Upload one commit to a site's Preview of the pull request and prove it
 * serves. `gated` is what its gate found failing, if anything: the upload
 * goes on, and is reported as failing its checks with the served ones.
 */
async function upload(
  cloudflare: Account,
  site: Site,
  target: {
    readonly pr: number;
    readonly origin: string;
    readonly sha: string;
    readonly gated: string | null;
  }
): Promise<void> {
  const { pr, origin, sha, gated } = target;
  const name = previewNameOfPr(pr);
  say(`▸ ${site.key}: wrangler preview --name ${name}`);
  const result = must(
    'wrangler preview',
    await runAsync(
      WRANGLER,
      [
        'preview',
        '--name',
        name,
        '--config',
        writeConfig(site),
        '--tag',
        sha.slice(0, 12),
        '--message',
        `PR #${String(pr)} at ${sha.slice(0, 12)}`,
        '--json',
      ],
      { cwd: PACKAGE_DIR, env: wranglerEnv(cloudflare) }
    )
  );
  // What proves the origin is the wait below; this only says so sooner.
  const urls = previewUrls(result.stdout);
  if (!urls.includes(origin))
    say(
      `! Cloudflare names ${urls.join(', ') || 'no URL'} for the Preview; it was built for ${origin}`
    );
  say(`▸ waiting for ${origin} to serve ${sha.slice(0, 12)}`);
  if (!(await serving(origin, sha)))
    throw new UnhealthyPreview(
      failingChecks({
        gate: gated,
        served: `${origin} did not serve ${sha.slice(0, 12)} within two minutes`,
      }) ?? ''
    );
  const checks = await servedChecks(site, {
    origin,
    previewName: name,
    commit: sha,
  });
  const failing = failingChecks({
    gate: gated,
    served: printChecks(checks) ? null : failed(checks),
  });
  if (failing !== null) throw new UnhealthyPreview(failing);
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
 * Where a site of the pull request is, for a command that only reads it: the
 * URL its description names (a laptop's identity can differ from the
 * deploy's), accepted only when it has the shape of this pull request's
 * Preview on the custom domain or on workers.dev. `null` when the
 * description names none.
 */
function namedOrigin(site: Site, pr: number): string | null {
  const body = readPullRequest(pr)?.body ?? '';
  const named =
    site === HARNESS
      ? (envOf('PREVIEW_URL') ?? previewUrlInBody(body))
      : storybookUrlInBody(body);
  if (named === null) return null;
  const subdomain = /^[^.]+\.([^.]+)\.workers\.dev$/.exec(
    URL.canParse(named) ? new URL(named).hostname : ''
  )?.[1];
  if (
    !isPreviewOriginOf({
      origin: named,
      previewName: previewNameOfPr(pr),
      subdomain: subdomain ?? '',
      host: previewHost(site),
    })
  )
    fail(`${named} is not a Preview URL of pull request #${String(pr)}`);
  return new URL(named).origin;
}

/** How long a first deploy may wait for its DNS record and certificate. */
const MAIN_READY_MS = 10 * 60 * 1000;

function mainOrigin(site: Site = HARNESS): string {
  const host = previewHost(site);
  if (host === null) fail(`the ${site.key} config names no custom domain`);
  return `https://${host}`;
}

/** `wrangler deploy`: the Worker's own deployment, which the domain serves. */
function deployWorker(cloudflare: Account, site: Site, message: string): void {
  say(`▸ ${site.key}: wrangler deploy`);
  must(
    'wrangler deploy',
    wrangler(cloudflare, [
      'deploy',
      '--config',
      writeConfig(site),
      '--message',
      message,
    ])
  );
}

/** Deploy the built sites as the main branch's and prove they serve. */
async function deployMain(sha: string): Promise<void> {
  const cloudflare = account();
  for (const site of SITES.filter((each) => each.deploysMain)) {
    await gate(site, MAIN_PREVIEW_NAME, sha);
    const origin = mainOrigin(site);
    deployWorker(cloudflare, site, `main at ${sha.slice(0, 12)}`);
    say(`▸ waiting for ${origin} to serve ${sha.slice(0, 12)}`);
    if (!(await serving(origin, sha, MAIN_READY_MS)))
      throw new Error(`${origin} did not serve ${sha.slice(0, 12)} in time`);
    const checks = await servedChecks(site, {
      origin,
      previewName: MAIN_PREVIEW_NAME,
      commit: sha,
    });
    if (!printChecks(checks)) throw new Error(failed(checks));
    say(`✓ ${origin} serves ${sha.slice(0, 12)}`);
  }
}

/**
 * The custom domain is attached by the Worker's own deployment, which a push
 * to main makes. Until the first one there is no domain for any Preview, so
 * a pull request's deploy makes it once, from the bundle it just uploaded;
 * the next push to main replaces it. Never fatal: the Preview itself is
 * already serving on the URL it was built for. Storybook's domain is the
 * released site's and is never attached from here.
 */
async function ensureMainPreview(
  cloudflare: Account,
  site: Site
): Promise<void> {
  const host = previewHost(site);
  if (!site.deploysMain) return;
  if (host === null || (await answers(`https://${host}`))) return;
  say(`▸ ${host} is not served yet: attaching it with a first deployment`);
  try {
    deployWorker(
      cloudflare,
      site,
      'first deployment: attach the custom domain'
    );
  } catch (error) {
    say(
      `! ${host} could not be attached (${error instanceof Error ? error.message : String(error)}); Previews stay on workers.dev`
    );
  }
}

/**
 * A site these commands never deploy gets its Preview settings from the
 * release that does. Until that release has run they are applied here, as the
 * same two settings and nothing else. Never fatal: without them the Preview
 * is uploaded but not served, which the checks then report.
 */
async function servePreviews(cloudflare: Account, site: Site): Promise<void> {
  if (site.deploysMain) return;
  try {
    await cloudflare.previews(site).servePreviews(previewHost(site));
  } catch (error) {
    say(
      `! ${site.key}: Previews could not be enabled (${error instanceof Error ? error.message : String(error)})`
    );
  }
}

async function deploy(pr: number, deploymentSha: string | null): Promise<void> {
  const cloudflare = account();
  for (const site of SITES) await servePreviews(cloudflare, site);
  const origin = await originOf(HARNESS, pr, cloudflare);
  const storybook = await originOf(STORYBOOK, pr, cloudflare);
  const sha = deploymentSha ?? headCommit().sha;
  const facts = {
    url: origin,
    storybookUrl: storybook,
    attemptedSha: sha,
    runUrl: runUrl(),
  };
  const deployment = createDeployment(pr, sha);
  deploymentStatus(deployment, 'in_progress', { url: origin });
  const live = {
    ...facts,
    status: 'live',
    deployedSha: sha,
    detail: null,
  } as const;
  try {
    // The two sites go up beside one another. The harness is what a reviewer
    // opens, so the pull request says it is live the moment it is, whatever
    // Storybook is still doing. Each goes up whatever its gate says: a site
    // failing its checks is still uploaded and reported as unhealthy.
    const name = previewNameOfPr(pr);
    const [harness, stories] = await Promise.allSettled([
      (async () => {
        const gated = await gate(HARNESS, name, sha);
        await upload(cloudflare, HARNESS, { pr, origin, sha, gated });
        publishSection(pr, live);
      })(),
      (async () => {
        await buildStorybook(name, sha);
        const gated = await gate(STORYBOOK, name, sha);
        await upload(cloudflare, STORYBOOK, {
          pr,
          origin: storybook,
          sha,
          gated,
        });
      })(),
    ]);
    if (harness.status === 'rejected') throw harness.reason;
    if (stories.status === 'rejected') throw stories.reason;
    for (const site of SITES) await ensureMainPreview(cloudflare, site);
    pruneDeployments(pr, deployment);
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
      // Read back, not assumed: one site can be up when the other failed.
      deployedSha: await deployedCommit(origin),
      detail: detail.replaceAll('\n', ' ').slice(0, 600),
    });
    throw error;
  }
  deploymentStatus(deployment, 'success', {
    url: origin,
    description: `${previewNameOfPr(pr)} serves ${sha.slice(0, 12)}`,
  });
  publishSection(pr, live);
  say(`✓ ${origin} serves ${sha.slice(0, 12)}`);
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
  for (const site of SITES) {
    const previews = cloudflare.previews(site);
    if ((await previews.preview(name)) === null) {
      say(`✓ ${site.key} ${name}: no such Preview (already removed)`);
      continue;
    }
    await previews.remove(name);
    let gone = false;
    for (let attempt = 0; attempt < 10 && !gone; attempt += 1) {
      gone = (await previews.preview(name)) === null;
      if (!gone) await sleep(2000);
    }
    if (!gone)
      throw new Error(
        `${site.key} ${name}: Cloudflare still reports the Preview after delete`
      );
    say(`✓ ${site.key} ${name}: Preview deleted and confirmed gone`);
  }
  pruneDeployments(pr, null);
  publishSection(pr, {
    status,
    url: null,
    storybookUrl: null,
    deployedSha: null,
    attemptedSha: null,
    runUrl: runUrl(),
    detail: null,
  });
}

type Listed = { readonly number: number; readonly updatedAt: string };

/** Every Preview name any site holds: a pull request can be left with one. */
async function previewNames(
  cloudflare: Account,
  open: readonly Listed[]
): Promise<readonly string[]> {
  const names = new Set<string>();
  let closed: readonly Listed[] | null = null;
  for (const site of SITES) {
    const previews = cloudflare.previews(site);
    const listed = await previews.names();
    if (listed !== null) {
      for (const name of listed) names.add(name);
      continue;
    }
    // Cloudflare would not list: ask about each recently closed pull request.
    say(
      `Cloudflare did not list the ${site.key} Previews; probing recently closed pull requests`
    );
    closed ??= listPullRequests('closed', 200);
    for (const pull of [...closed, ...open]) {
      const name = previewNameOfPr(pull.number);
      if ((await previews.preview(name)) !== null) names.add(name);
    }
  }
  return [...names];
}

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
  const names = await previewNames(cloudflare, open);
  const plan = planSweep({
    previewNames: names,
    open: open.map((pull) => ({
      pr: pull.number,
      updatedAtMs: Date.parse(pull.updatedAt),
    })),
    nowMs: wallClock.now(),
    retentionMs: PREVIEW_RETENTION_MS,
    capacity: PREVIEW_CAPACITY,
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
  if (event === 'push') {
    const sha = envOf('GITHUB_SHA');
    if (sha === null) fail('GITHUB_SHA is not set');
    return { kind: 'main', sha };
  }
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

/** The main branch's head as GitHub has it now. */
function mainHead(): string | null {
  const result = run('gh', ['api', 'repos/{owner}/{repo}/commits/main']);
  if (result.code !== 0) return null;
  const sha = (JSON.parse(result.stdout) as { sha?: unknown }).sha;
  return typeof sha === 'string' ? sha : null;
}

function plan(): PreviewAction {
  const from = trigger();
  if (from.kind === 'sweep') return { kind: 'sweep' };
  if (from.kind === 'main') return decideMainAction(from.sha, mainHead());
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
    const cloudflare = action.kind === 'deploy' ? account() : null;
    const origin =
      action.kind === 'deploy'
        ? await originOf(HARNESS, action.pr, cloudflare)
        : action.kind === 'deploy-main'
          ? mainOrigin()
          : '';
    output({
      action: action.kind,
      pr: 'pr' in action ? String(action.pr) : '',
      url: origin,
    });
    if (action.kind === 'deploy')
      publishSection(action.pr, {
        status: 'deploying',
        url: origin,
        storybookUrl: await originOf(STORYBOOK, action.pr, cloudflare),
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
    if (action === 'deploy-main') await build(MAIN_PREVIEW_NAME, mainOrigin());
    else await build(previewNameOfPr(pr), await originOf(HARNESS, pr, null));
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
    } else if (action === 'deploy-main') {
      // The plan was made before the build; main may have moved since.
      const now = plan();
      if (now.kind === 'deploy-main') await deployMain(now.sha);
      else say(`skip: ${now.kind === 'skip' ? now.reason : now.kind}`);
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
    const origin =
      previewUrlInBody(pull.body) ?? (await originOf(HARNESS, pr, null));
    publishSection(pr, {
      status: 'failed',
      url: origin,
      storybookUrl: storybookUrlInBody(pull.body),
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
      if (envOf('PREVIEW_ACTION') === 'deploy-main') {
        await build(MAIN_PREVIEW_NAME, mainOrigin());
        break;
      }
      const pr = currentPr();
      await build(previewNameOfPr(pr), await originOf(HARNESS, pr, null));
      break;
    }
    case 'deploy': {
      const pr = currentPr();
      await build(previewNameOfPr(pr), await originOf(HARNESS, pr, null));
      await deploy(pr, null);
      break;
    }
    case 'test': {
      const pr = currentPr();
      let ok = true;
      for (const site of SITES) {
        const origin = namedOrigin(site, pr);
        if (origin === null) {
          // A description from before Storybook had a Preview names only one.
          if (site === HARNESS)
            fail('the pull request names no Preview URL yet');
          continue;
        }
        say(`▸ checking ${origin}`);
        const passed = printChecks(
          await site.checks({
            origin,
            fetch,
            previewName: previewNameOfPr(pr),
            commit: null,
          })
        );
        ok = ok && passed;
      }
      if (!ok) process.exit(1);
      break;
    }
    case 'main':
      await build(MAIN_PREVIEW_NAME, mainOrigin());
      await deployMain(headCommit().sha);
      break;
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
      fail('usage: preview <url|build|deploy|main|test|destroy|sweep|ci>');
  }
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
