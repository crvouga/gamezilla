#!/usr/bin/env bun
/**
 * Idempotent setup for CI → Infisical OIDC auth.
 *
 * The deployment pipeline authenticates to Infisical via GitHub Actions OIDC
 * (see `.github/actions/secrets-auth`). That requires two GitHub Actions
 * repository variables that are NOT stored in Infisical:
 *
 *   - INFISICAL_PROJECT_SLUG  — the Infisical project slug
 *   - INFISICAL_IDENTITY_ID   — a machine identity configured for GitHub OIDC
 *
 * This script makes the whole chain reproducible and safe to re-run:
 *
 *   1. Resolve the project slug + org id from `.infisical.json`'s workspaceId.
 *   2. Ensure a machine identity exists with GitHub Actions OIDC auth bound to
 *      this repo, and that it's a member of the project.
 *   3. Set the two GitHub repo variables (only when they differ).
 *
 * Auth (needs org admin rights for steps 1–2), resolved in this order:
 *   1. INFISICAL_TOKEN=<access token>
 *   2. INFISICAL_CLIENT_ID + INFISICAL_CLIENT_SECRET (universal auth login)
 *   3. Your logged-in Infisical CLI session (macOS keychain) — just run
 *      `infisical login` first and this script works with zero env vars.
 *
 * If you already created the identity by hand, pass INFISICAL_IDENTITY_ID (and
 * optionally INFISICAL_PROJECT_SLUG) and the script skips the API steps,
 * only reconciling the GitHub variables.
 *
 * Flags:
 *   --repo <owner/name>   Override the GitHub repo (default: `gh` current repo)
 *   --identity-name <s>   Machine identity name (default: github-actions-<repo>)
 *   --dry-run             Print planned changes without applying them.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { readSecretsConfig } from '@pkgs/secrets-config/infisical-json';

const REPO_ROOT = join(import.meta.dirname, '..');

const GITHUB_OIDC_ISSUER = 'https://token.actions.githubusercontent.com';
const IDENTITY_ENV_VAR = 'INFISICAL_IDENTITY_ID';
const PROJECT_SLUG_ENV_VAR = 'INFISICAL_PROJECT_SLUG';

type Cli = {
  readonly repo: string | null;
  readonly identityName: string | null;
  readonly dryRun: boolean;
};

type InfisicalCtx = {
  readonly domain: string;
  readonly workspaceId: string;
  readonly token: string;
};

type ProjectInfo = {
  readonly slug: string;
  readonly orgId: string;
};

function log(message: string): void {
  console.log(`[setup-ci-secrets-auth] ${message}`);
}

function fail(message: string): never {
  console.error(`[setup-ci-secrets-auth] ERROR: ${message}`);
  process.exit(1);
}

function trimEnv(name: string): string {
  return (process.env[name] ?? '').trim();
}

function parseCli(argv: readonly string[]): Cli {
  let repo: string | null = null;
  let identityName: string | null = null;
  let dryRun = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') dryRun = true;
    else if (arg === '--repo') repo = argv[(i += 1)] ?? null;
    else if (arg === '--identity-name') identityName = argv[(i += 1)] ?? null;
  }
  return { repo, identityName, dryRun };
}

function normalizeDomain(domain: string): string {
  return domain.replace(/\/+$/, '');
}

// ── Infisical auth ──────────────────────────────────────────────────────────

async function loginUniversalAuth(
  domain: string,
  clientId: string,
  clientSecret: string
): Promise<string> {
  const res = await fetch(`${domain}/api/v1/auth/universal-auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ clientId, clientSecret }),
  });
  if (!res.ok) {
    fail(`Infisical universal-auth login failed: HTTP ${res.status}`);
  }
  const body = (await res.json()) as { accessToken?: string };
  const token = body.accessToken?.trim() ?? '';
  if (token.length === 0) fail('Infisical login returned no access token');
  return token;
}

type CliLogin = {
  readonly email: string;
  readonly domain: string;
};

function readCliLogin(): CliLogin | null {
  try {
    const raw = readFileSync(
      join(homedir(), '.infisical', 'infisical-config.json'),
      'utf8'
    );
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const email =
      typeof parsed['loggedInUserEmail'] === 'string'
        ? parsed['loggedInUserEmail']
        : '';
    const rawDomain =
      typeof parsed['LoggedInUserDomain'] === 'string'
        ? parsed['LoggedInUserDomain']
        : '';
    if (email.length === 0) return null;
    return { email, domain: normalizeDomain(rawDomain.replace(/\/api$/, '')) };
  } catch {
    return null;
  }
}

/** Extract the JWT the Infisical CLI stored in the macOS keychain. */
function readCliKeychainToken(email: string): string | null {
  if (process.platform !== 'darwin') return null;
  const result = spawnSync(
    'security',
    ['find-generic-password', '-s', 'infisical-cli', '-a', email, '-w'],
    { encoding: 'utf8' }
  );
  if (result.status !== 0) return null;
  const raw = (result.stdout ?? '').trim();
  const base64 = raw.replace(/^go-keyring-base64:/, '');
  try {
    const json = JSON.parse(
      Buffer.from(base64, 'base64').toString('utf8')
    ) as Record<string, unknown>;
    const token =
      typeof json['JTWToken'] === 'string' ? json['JTWToken'].trim() : '';
    return token.length > 0 ? token : null;
  } catch {
    return null;
  }
}

function resolveCliToken(domain: string): string | null {
  const login = readCliLogin();
  if (login === null) return null;
  if (login.domain.length > 0 && login.domain !== domain) {
    log(
      `Skipping CLI session: logged into ${login.domain}, project domain is ${domain}.`
    );
    return null;
  }
  const token = readCliKeychainToken(login.email);
  if (token === null) return null;
  log(`Using logged-in Infisical CLI session (${login.email}).`);
  return token;
}

async function resolveInfisicalToken(domain: string): Promise<string | null> {
  const explicit = trimEnv('INFISICAL_TOKEN');
  if (explicit.length > 0) {
    log('Using INFISICAL_TOKEN from env.');
    return explicit;
  }
  const clientId = trimEnv('INFISICAL_CLIENT_ID');
  const clientSecret = trimEnv('INFISICAL_CLIENT_SECRET');
  if (clientId.length > 0 && clientSecret.length > 0) {
    log('Authenticating to Infisical via universal auth…');
    return loginUniversalAuth(domain, clientId, clientSecret);
  }
  return resolveCliToken(domain);
}

async function infisicalRequest(
  ctx: InfisicalCtx,
  method: string,
  path: string,
  body?: unknown
): Promise<{ status: number; json: unknown }> {
  const init: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${ctx.token}`,
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  };
  const res = await fetch(`${ctx.domain}${path}`, init);
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, json };
}

// ── Project + identity reconciliation ─────────────────────────────────────────

async function resolveProjectInfo(ctx: InfisicalCtx): Promise<ProjectInfo> {
  const { status, json } = await infisicalRequest(
    ctx,
    'GET',
    `/api/v1/workspace/${ctx.workspaceId}`
  );
  if (status !== 200 || json === null || typeof json !== 'object') {
    fail(
      `Could not read project ${ctx.workspaceId} (HTTP ${status}). ` +
        'Ensure the token has access to this project.'
    );
  }
  const outer = json as Record<string, unknown>;
  const project = outer['workspace'] ?? outer['project'] ?? json;
  const rec = project as Record<string, unknown>;
  const slug = typeof rec['slug'] === 'string' ? rec['slug'] : '';
  const orgId = typeof rec['orgId'] === 'string' ? rec['orgId'] : '';
  if (slug.length === 0 || orgId.length === 0) {
    fail('Project response missing slug/orgId — unexpected API shape.');
  }
  log(`Resolved project slug="${slug}" orgId="${orgId}".`);
  return { slug, orgId };
}

async function identityExists(
  ctx: InfisicalCtx,
  identityId: string
): Promise<boolean> {
  const { status } = await infisicalRequest(
    ctx,
    'GET',
    `/api/v1/identities/${identityId}`
  );
  return status === 200;
}

async function findIdentityByName(
  ctx: InfisicalCtx,
  orgId: string,
  name: string
): Promise<string | null> {
  const { status, json } = await infisicalRequest(
    ctx,
    'GET',
    `/api/v2/organizations/${orgId}/identity-memberships?limit=100`
  );
  if (status !== 200 || json === null || typeof json !== 'object') return null;
  const memberships = (json as Record<string, unknown>)['identityMemberships'];
  if (!Array.isArray(memberships)) return null;
  for (const entry of memberships) {
    const identity = (entry as Record<string, unknown>)['identity'] as
      | Record<string, unknown>
      | undefined;
    if (identity?.['name'] === name && typeof identity['id'] === 'string') {
      return identity['id'];
    }
  }
  return null;
}

async function createIdentity(
  ctx: InfisicalCtx,
  orgId: string,
  name: string
): Promise<string> {
  const { status, json } = await infisicalRequest(
    ctx,
    'POST',
    '/api/v1/identities',
    {
      name,
      organizationId: orgId,
      role: 'no-access',
    }
  );
  if (status !== 200 || json === null || typeof json !== 'object') {
    fail(`Failed to create identity "${name}" (HTTP ${status}).`);
  }
  const identity = (json as Record<string, unknown>)['identity'] as
    | Record<string, unknown>
    | undefined;
  const id = typeof identity?.['id'] === 'string' ? identity['id'] : '';
  if (id.length === 0) fail('Create identity returned no id.');
  log(`Created machine identity "${name}" (${id}).`);
  return id;
}

async function ensureOidcAuth(
  ctx: InfisicalCtx,
  identityId: string,
  repo: string
): Promise<void> {
  const owner = repo.split('/')[0] ?? '';
  const body = {
    oidcDiscoveryUrl: GITHUB_OIDC_ISSUER,
    boundIssuer: GITHUB_OIDC_ISSUER,
    boundSubject: `repo:${repo}:*`,
    boundAudiences:
      trimEnv('INFISICAL_OIDC_AUDIENCE') || `https://github.com/${owner}`,
    boundClaims: {},
    accessTokenTTL: 600,
    accessTokenMaxTTL: 600,
    accessTokenNumUsesLimit: 0,
  };
  const path = `/api/v1/auth/oidc-auth/identities/${identityId}`;
  const created = await infisicalRequest(ctx, 'POST', path, body);
  if (created.status === 200) {
    log('Attached GitHub OIDC auth to identity.');
    return;
  }
  const updated = await infisicalRequest(ctx, 'PATCH', path, body);
  if (updated.status === 200) {
    log('Updated existing GitHub OIDC auth on identity.');
    return;
  }
  fail(
    `Failed to configure OIDC auth (POST HTTP ${created.status}, PATCH HTTP ${updated.status}).`
  );
}

function membershipErrorMeansExists(json: unknown): boolean {
  if (json === null || typeof json !== 'object') return false;
  const message = String((json as Record<string, unknown>)['message'] ?? '');
  return /already|exists|member/i.test(message);
}

async function ensureProjectMembership(
  ctx: InfisicalCtx,
  identityId: string
): Promise<void> {
  const path = `/api/v1/projects/${ctx.workspaceId}/memberships/identities/${identityId}`;
  // Older Infisical expects `{ role }`; newer expects `{ roles: [{ role }] }`.
  const bodies = [{ role: 'admin' }, { roles: [{ role: 'admin' }] }];
  for (const body of bodies) {
    const { status, json } = await infisicalRequest(ctx, 'POST', path, body);
    if (status === 200 || status === 201) {
      log('Added identity to project (role: admin).');
      return;
    }
    if (
      status === 409 ||
      (status === 400 && membershipErrorMeansExists(json))
    ) {
      log('Identity already a project member — skipping.');
      return;
    }
  }
  fail(
    `Failed to add identity to project ${ctx.workspaceId} — check the token's project permissions.`
  );
}

async function ensureIdentity(
  ctx: InfisicalCtx,
  project: ProjectInfo,
  repo: string,
  identityName: string,
  dryRun: boolean
): Promise<string> {
  const fromVar =
    trimEnv(IDENTITY_ENV_VAR) || readGithubVariable(repo, IDENTITY_ENV_VAR);
  const existing =
    fromVar.length > 0 && (await identityExists(ctx, fromVar))
      ? fromVar
      : await findIdentityByName(ctx, project.orgId, identityName);

  if (existing !== null && existing.length > 0) {
    log(`Reusing existing identity ${existing}.`);
    if (!dryRun) {
      await ensureOidcAuth(ctx, existing, repo);
      await ensureProjectMembership(ctx, existing);
    }
    return existing;
  }
  if (dryRun) {
    log(
      `DRY RUN: would create identity "${identityName}" + OIDC + membership.`
    );
    return '<new-identity-id>';
  }
  const id = await createIdentity(ctx, project.orgId, identityName);
  await ensureOidcAuth(ctx, id, repo);
  await ensureProjectMembership(ctx, id);
  return id;
}

// ── GitHub variables ──────────────────────────────────────────────────────────

function runGh(args: readonly string[]): { status: number; stdout: string } {
  const result = spawnSync('gh', [...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  if (result.error !== undefined) {
    fail(
      `failed to run gh: ${result.error.message} (is the GitHub CLI installed + authed?)`
    );
  }
  return { status: result.status ?? 1, stdout: (result.stdout ?? '').trim() };
}

function resolveRepo(cliRepo: string | null): string {
  if (cliRepo !== null && cliRepo.length > 0) return cliRepo;
  const fromEnv = trimEnv('GITHUB_REPOSITORY');
  if (fromEnv.length > 0) return fromEnv;
  const { status, stdout } = runGh([
    'repo',
    'view',
    '--json',
    'nameWithOwner',
    '-q',
    '.nameWithOwner',
  ]);
  if (status !== 0 || stdout.length === 0) {
    fail('Could not resolve GitHub repo — pass --repo <owner/name>.');
  }
  return stdout;
}

function readGithubVariable(repo: string, name: string): string {
  const { status, stdout } = runGh(['variable', 'get', name, '--repo', repo]);
  return status === 0 ? stdout : '';
}

function setGithubVariable(
  repo: string,
  name: string,
  value: string,
  dryRun: boolean
): void {
  const current = readGithubVariable(repo, name);
  if (current === value) {
    log(`${name} already set correctly — skipping.`);
    return;
  }
  if (dryRun) {
    log(`DRY RUN: would set ${name}=${value} (was "${current}").`);
    return;
  }
  const { status } = runGh([
    'variable',
    'set',
    name,
    '--repo',
    repo,
    '--body',
    value,
  ]);
  if (status !== 0) fail(`Failed to set GitHub variable ${name}.`);
  log(`Set ${name}=${value}.`);
}

// ── Orchestration ─────────────────────────────────────────────────────────────

function resolveProjectSlugFallback(): string {
  const slug = trimEnv(PROJECT_SLUG_ENV_VAR);
  if (slug.length === 0) {
    fail(
      'No Infisical token available and INFISICAL_PROJECT_SLUG is unset. ' +
        'Run `infisical login`, or provide INFISICAL_TOKEN / ' +
        'INFISICAL_CLIENT_ID+INFISICAL_CLIENT_SECRET, or pass ' +
        'INFISICAL_PROJECT_SLUG + INFISICAL_IDENTITY_ID to only set GitHub vars.'
    );
  }
  return slug;
}

async function main(): Promise<void> {
  const cli = parseCli(process.argv.slice(2));
  const config = readSecretsConfig(REPO_ROOT);
  const domain = normalizeDomain(config.domain ?? 'https://app.infisical.com');
  const repo = resolveRepo(cli.repo);
  const identityName =
    cli.identityName ?? `github-actions-${repo.split('/')[1] ?? 'ci'}`;
  log(`repo=${repo} workspaceId=${config.workspaceId} domain=${domain}`);

  const token = await resolveInfisicalToken(domain);

  let projectSlug: string;
  let identityId: string;

  if (token === null) {
    log('No Infisical admin token — GitHub-variables-only mode.');
    projectSlug = resolveProjectSlugFallback();
    identityId =
      trimEnv(IDENTITY_ENV_VAR) || readGithubVariable(repo, IDENTITY_ENV_VAR);
    if (identityId.length === 0) {
      fail(
        'INFISICAL_IDENTITY_ID is unset and no admin token to create one. ' +
          'Create a machine identity in Infisical (OIDC auth) and pass its id.'
      );
    }
  } else {
    const ctx: InfisicalCtx = {
      domain,
      workspaceId: config.workspaceId,
      token,
    };
    const project = await resolveProjectInfo(ctx);
    projectSlug = project.slug;
    identityId = await ensureIdentity(
      ctx,
      project,
      repo,
      identityName,
      cli.dryRun
    );
  }

  setGithubVariable(repo, PROJECT_SLUG_ENV_VAR, projectSlug, cli.dryRun);
  setGithubVariable(repo, IDENTITY_ENV_VAR, identityId, cli.dryRun);

  log('Done. Re-run any time — every step is idempotent.');
  log(
    `Verify: gh variable list --repo ${repo}  →  ${PROJECT_SLUG_ENV_VAR}, ${IDENTITY_ENV_VAR}`
  );
}

await main();
