/**
 * Idempotent Infisical machine-identity + GitHub OIDC reconciliation.
 * Provider-private: called only via the neutral `reconcileCiSecretsAuth` facade.
 */
import { readSecretsConfig } from '@pkgs/secrets-config';
import { resolveInfisicalAdminToken } from './ci-reconcile-auth';
import {
  readGithubVariable,
  resolveGithubRepo,
  setGithubVariable,
} from './ci-reconcile-github';
import {
  ensureIdentity,
  resolveProjectInfo,
  SECRETS_IDENTITY_ID_VAR,
  SECRETS_PROJECT_ID_VAR,
} from './ci-reconcile-identity';
import type {
  InfisicalCtx,
  ReconcileFail,
  ReconcileLog,
} from './ci-reconcile-types';
import { INFISICAL_DEFAULT_ENDPOINT } from './defaults';
import { resolveInfisicalEndpoint } from './resolve-endpoint';

const LEGACY_IDENTITY_ENV_VAR = 'INFISICAL_IDENTITY_ID';
const LEGACY_PROJECT_SLUG_ENV_VAR = 'INFISICAL_PROJECT_SLUG';

export type ReconcileInfisicalCiSecretsAuthOptions = {
  readonly repoRoot: string;
  readonly repo?: string | null;
  readonly identityName?: string | null;
  readonly dryRun?: boolean;
  readonly log?: (message: string) => void;
};

export { SECRETS_IDENTITY_ID_VAR, SECRETS_PROJECT_ID_VAR };

function trimEnv(name: string): string {
  return (process.env[name] ?? '').trim();
}

function normalizeDomain(domain: string): string {
  return domain.replace(/\/+$/, '');
}

function resolveLegacyOnlyIds(args: {
  readonly repoRoot: string;
  readonly repo: string;
  readonly fail: ReconcileFail;
}): { projectSlug: string; identityId: string } {
  const projectSlug =
    trimEnv(SECRETS_PROJECT_ID_VAR) ||
    trimEnv(LEGACY_PROJECT_SLUG_ENV_VAR) ||
    readGithubVariable({
      repoRoot: args.repoRoot,
      repo: args.repo,
      name: LEGACY_PROJECT_SLUG_ENV_VAR,
      fail: args.fail,
    });
  if (projectSlug.length === 0) {
    args.fail(
      'No admin token and SECRETS_PROJECT_ID / legacy INFISICAL_PROJECT_SLUG unset. ' +
        'Provide SECRETS_TOKEN or pass SECRETS_PROJECT_ID + SECRETS_IDENTITY_ID.'
    );
  }
  const identityId =
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
  if (identityId.length === 0) {
    args.fail(
      'SECRETS_IDENTITY_ID is unset and no admin token to create one. ' +
        'Create a machine identity (OIDC auth) and pass its id.'
    );
  }
  return { projectSlug, identityId };
}

async function resolveProjectAndIdentity(args: {
  readonly repoRoot: string;
  readonly repo: string;
  readonly identityName: string;
  readonly dryRun: boolean;
  readonly domain: string;
  readonly projectId: string;
  readonly log: ReconcileLog;
  readonly fail: ReconcileFail;
}): Promise<{ projectSlug: string; identityId: string }> {
  const token = await resolveInfisicalAdminToken({
    domain: args.domain,
    log: args.log,
    fail: args.fail,
  });
  if (token === null) {
    args.log('No secrets admin token — GitHub-variables-only mode.');
    return resolveLegacyOnlyIds(args);
  }
  const ctx: InfisicalCtx = {
    domain: args.domain,
    workspaceId: args.projectId,
    token,
  };
  const project = await resolveProjectInfo({
    ctx,
    log: args.log,
    fail: args.fail,
  });
  const identityId = await ensureIdentity({
    ctx,
    project,
    repo: args.repo,
    identityName: args.identityName,
    dryRun: args.dryRun,
    repoRoot: args.repoRoot,
    log: args.log,
    fail: args.fail,
  });
  return { projectSlug: project.slug, identityId };
}

function publishGithubVars(args: {
  readonly repoRoot: string;
  readonly repo: string;
  readonly projectSlug: string;
  readonly identityId: string;
  readonly dryRun: boolean;
  readonly log: ReconcileLog;
  readonly fail: ReconcileFail;
}): void {
  setGithubVariable({
    repoRoot: args.repoRoot,
    repo: args.repo,
    name: SECRETS_PROJECT_ID_VAR,
    value: args.projectSlug,
    dryRun: args.dryRun,
    log: args.log,
    fail: args.fail,
  });
  setGithubVariable({
    repoRoot: args.repoRoot,
    repo: args.repo,
    name: SECRETS_IDENTITY_ID_VAR,
    value: args.identityId,
    dryRun: args.dryRun,
    log: args.log,
    fail: args.fail,
  });
  const legacySlug = readGithubVariable({
    repoRoot: args.repoRoot,
    repo: args.repo,
    name: LEGACY_PROJECT_SLUG_ENV_VAR,
    fail: args.fail,
  });
  const legacyIdentity = readGithubVariable({
    repoRoot: args.repoRoot,
    repo: args.repo,
    name: LEGACY_IDENTITY_ENV_VAR,
    fail: args.fail,
  });
  if (legacySlug.length > 0 || legacyIdentity.length > 0) {
    args.log(
      `Legacy vars still present (${LEGACY_PROJECT_SLUG_ENV_VAR}, ${LEGACY_IDENTITY_ENV_VAR}) — ` +
        'safe to delete after workflows use SECRETS_* names.'
    );
  }
}

export async function reconcileInfisicalCiSecretsAuth(
  options: ReconcileInfisicalCiSecretsAuthOptions
): Promise<void> {
  const log =
    options.log ??
    ((message: string) => {
      process.stdout.write(`${message}\n`);
    });
  const fail: ReconcileFail = (message) => {
    throw new Error(message);
  };
  const dryRun = options.dryRun === true;
  const config = readSecretsConfig(options.repoRoot);
  const domain = normalizeDomain(
    resolveInfisicalEndpoint({
      endpoint: config.endpoint ?? INFISICAL_DEFAULT_ENDPOINT,
    })
  );
  const repo = resolveGithubRepo({
    repoRoot: options.repoRoot,
    cliRepo: options.repo,
    fail,
  });
  const identityName =
    options.identityName ?? `github-actions-${repo.split('/')[1] ?? 'ci'}`;
  log(`repo=${repo} projectId=${config.projectId} endpoint=${domain}`);

  const resolved = await resolveProjectAndIdentity({
    repoRoot: options.repoRoot,
    repo,
    identityName,
    dryRun,
    domain,
    projectId: config.projectId,
    log,
    fail,
  });
  publishGithubVars({
    repoRoot: options.repoRoot,
    repo,
    projectSlug: resolved.projectSlug,
    identityId: resolved.identityId,
    dryRun,
    log,
    fail,
  });

  log('Done. Re-run any time — every step is idempotent.');
  log(
    `Verify: gh variable list --repo ${repo}  →  ${SECRETS_PROJECT_ID_VAR}, ${SECRETS_IDENTITY_ID_VAR}`
  );
}
