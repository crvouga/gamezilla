import { readGithubVariable } from './ci-reconcile-github';
import { infisicalRequest } from './ci-reconcile-http';
import type {
  InfisicalCtx,
  ProjectInfo,
  ReconcileFail,
  ReconcileLog,
} from './ci-reconcile-types';

const GITHUB_OIDC_ISSUER = 'https://token.actions.githubusercontent.com';

export const SECRETS_IDENTITY_ID_VAR = 'SECRETS_IDENTITY_ID';
export const SECRETS_PROJECT_ID_VAR = 'SECRETS_PROJECT_ID';
const LEGACY_IDENTITY_ENV_VAR = 'INFISICAL_IDENTITY_ID';

function trimEnv(name: string): string {
  return (process.env[name] ?? '').trim();
}

export async function resolveProjectInfo(args: {
  readonly ctx: InfisicalCtx;
  readonly log: ReconcileLog;
  readonly fail: ReconcileFail;
}): Promise<ProjectInfo> {
  const { status, json } = await infisicalRequest(
    args.ctx,
    'GET',
    `/api/v1/workspace/${args.ctx.workspaceId}`
  );
  if (status !== 200 || json === null || typeof json !== 'object') {
    args.fail(
      `Could not read project ${args.ctx.workspaceId} (HTTP ${status}). ` +
        'Ensure the token has access to this project.'
    );
  }
  const outer = json as Record<string, unknown>;
  const project = outer['workspace'] ?? outer['project'] ?? json;
  const rec = project as Record<string, unknown>;
  const slug = typeof rec['slug'] === 'string' ? rec['slug'] : '';
  const orgId = typeof rec['orgId'] === 'string' ? rec['orgId'] : '';
  if (slug.length === 0 || orgId.length === 0) {
    args.fail('Project response missing slug/orgId — unexpected API shape.');
  }
  args.log(`Resolved project slug="${slug}" orgId="${orgId}".`);
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

async function createIdentity(args: {
  readonly ctx: InfisicalCtx;
  readonly orgId: string;
  readonly name: string;
  readonly log: ReconcileLog;
  readonly fail: ReconcileFail;
}): Promise<string> {
  const { status, json } = await infisicalRequest(
    args.ctx,
    'POST',
    '/api/v1/identities',
    {
      name: args.name,
      organizationId: args.orgId,
      role: 'no-access',
    }
  );
  if (status !== 200 || json === null || typeof json !== 'object') {
    args.fail(`Failed to create identity "${args.name}" (HTTP ${status}).`);
  }
  const identity = (json as Record<string, unknown>)['identity'] as
    | Record<string, unknown>
    | undefined;
  const id = typeof identity?.['id'] === 'string' ? identity['id'] : '';
  if (id.length === 0) args.fail('Create identity returned no id.');
  args.log(`Created machine identity "${args.name}" (${id}).`);
  return id;
}

async function ensureOidcAuth(args: {
  readonly ctx: InfisicalCtx;
  readonly identityId: string;
  readonly repo: string;
  readonly log: ReconcileLog;
  readonly fail: ReconcileFail;
}): Promise<void> {
  const owner = args.repo.split('/')[0] ?? '';
  const body = {
    oidcDiscoveryUrl: GITHUB_OIDC_ISSUER,
    boundIssuer: GITHUB_OIDC_ISSUER,
    boundSubject: `repo:${args.repo}:*`,
    boundAudiences:
      trimEnv('SECRETS_OIDC_AUDIENCE') ||
      trimEnv('INFISICAL_OIDC_AUDIENCE') ||
      `https://github.com/${owner}`,
    boundClaims: {},
    accessTokenTTL: 600,
    accessTokenMaxTTL: 600,
    accessTokenNumUsesLimit: 0,
  };
  const path = `/api/v1/auth/oidc-auth/identities/${args.identityId}`;
  const created = await infisicalRequest(args.ctx, 'POST', path, body);
  if (created.status === 200) {
    args.log('Attached GitHub OIDC auth to identity.');
    return;
  }
  const updated = await infisicalRequest(args.ctx, 'PATCH', path, body);
  if (updated.status === 200) {
    args.log('Updated existing GitHub OIDC auth on identity.');
    return;
  }
  args.fail(
    `Failed to configure OIDC auth (POST HTTP ${created.status}, PATCH HTTP ${updated.status}).`
  );
}

function membershipErrorMeansExists(json: unknown): boolean {
  if (json === null || typeof json !== 'object') return false;
  const message = String((json as Record<string, unknown>)['message'] ?? '');
  return /already|exists|member/i.test(message);
}

async function ensureProjectMembership(args: {
  readonly ctx: InfisicalCtx;
  readonly identityId: string;
  readonly log: ReconcileLog;
  readonly fail: ReconcileFail;
}): Promise<void> {
  const path = `/api/v1/projects/${args.ctx.workspaceId}/memberships/identities/${args.identityId}`;
  const bodies = [{ role: 'admin' }, { roles: [{ role: 'admin' }] }];
  for (const body of bodies) {
    const { status, json } = await infisicalRequest(
      args.ctx,
      'POST',
      path,
      body
    );
    if (status === 200 || status === 201) {
      args.log('Added identity to project (role: admin).');
      return;
    }
    if (
      status === 409 ||
      (status === 400 && membershipErrorMeansExists(json))
    ) {
      args.log('Identity already a project member — skipping.');
      return;
    }
  }
  args.fail(
    `Failed to add identity to project ${args.ctx.workspaceId} — check the token's project permissions.`
  );
}

async function resolveExistingIdentityId(args: {
  readonly ctx: InfisicalCtx;
  readonly project: ProjectInfo;
  readonly repo: string;
  readonly identityName: string;
  readonly repoRoot: string;
  readonly fail: ReconcileFail;
}): Promise<string | null> {
  const fromVar =
    trimEnv(SECRETS_IDENTITY_ID_VAR) ||
    trimEnv(LEGACY_IDENTITY_ENV_VAR) ||
    readGithubVariable({
      repoRoot: args.repoRoot,
      repo: args.repo,
      name: SECRETS_IDENTITY_ID_VAR,
      fail: args.fail,
    }) ||
    readGithubVariable({
      repoRoot: args.repoRoot,
      repo: args.repo,
      name: LEGACY_IDENTITY_ENV_VAR,
      fail: args.fail,
    });
  if (fromVar.length > 0 && (await identityExists(args.ctx, fromVar))) {
    return fromVar;
  }
  return findIdentityByName(args.ctx, args.project.orgId, args.identityName);
}

async function attachIdentityAccess(args: {
  readonly ctx: InfisicalCtx;
  readonly identityId: string;
  readonly repo: string;
  readonly log: ReconcileLog;
  readonly fail: ReconcileFail;
}): Promise<void> {
  await ensureOidcAuth(args);
  await ensureProjectMembership(args);
}

export async function ensureIdentity(args: {
  readonly ctx: InfisicalCtx;
  readonly project: ProjectInfo;
  readonly repo: string;
  readonly identityName: string;
  readonly dryRun: boolean;
  readonly repoRoot: string;
  readonly log: ReconcileLog;
  readonly fail: ReconcileFail;
}): Promise<string> {
  const existing = await resolveExistingIdentityId(args);
  if (existing !== null && existing.length > 0) {
    args.log(`Reusing existing identity ${existing}.`);
    if (!args.dryRun) {
      await attachIdentityAccess({ ...args, identityId: existing });
    }
    return existing;
  }
  if (args.dryRun) {
    args.log(
      `DRY RUN: would create identity "${args.identityName}" + OIDC + membership.`
    );
    return '<new-identity-id>';
  }
  const id = await createIdentity({
    ctx: args.ctx,
    orgId: args.project.orgId,
    name: args.identityName,
    log: args.log,
    fail: args.fail,
  });
  await attachIdentityAccess({ ...args, identityId: id });
  return id;
}
