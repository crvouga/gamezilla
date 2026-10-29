/**
 * Pure command lines and environment for running OpenTofu against one
 * target. The wrapper (`scripts/tofu.ts`) is the only caller; keeping this
 * pure lets tests pin exactly what reaches `tofu`.
 *
 *   bootstrap   global, by a person: state bucket, shared secrets
 *               environment, CI identity, the AWS OIDC role, repo
 *   fleet       global, by CI: every env file's secrets environment and its
 *               import of the shared one; the OAuth relay's hostname;
 *               the private spec-report bucket every env's API reads;
 *               the shared Railway project and its isolated environments
 *   foundation  per environment, before Worker code ships
 *   edge        per environment, after Worker code ships
 */

import type { AwsSession } from './aws-session';
import { accountKeySession } from './aws-session';

export type Stack = 'bootstrap' | 'fleet' | 'foundation' | 'edge';

export const STACKS: readonly Stack[] = [
  'bootstrap',
  'fleet',
  'foundation',
  'edge',
];

/** Stacks with one state object for the whole project, not one per env. */
export const GLOBAL_STACKS: readonly Stack[] = ['bootstrap', 'fleet'];

/** The per-environment stacks the deploy chain applies. */
export const ENV_STACKS: readonly Stack[] = ['foundation', 'edge'];

export type TofuPaths = {
  /** `libs/infra-shared-ts/tofu` */
  readonly tofuDir: string;
  /** `libs/infra/.cache/tofu` */
  readonly cacheDir: string;
};

/** A stack plus the environment it runs for (`null` for a global stack). */
export type Target = {
  readonly stack: Stack;
  readonly env: string | null;
};

export function stackDir(paths: TofuPaths, stack: Stack): string {
  return `${paths.tofuDir}/stacks/${stack}`;
}

/**
 * The resolved variable files OpenTofu reads (`tofu-var-files.ts`), relative
 * to `varsDir`: the committed ones carry identity placeholders, so the
 * wrapper writes these into the cache before any `tofu` run.
 */
export const GLOBAL_VAR_FILE = 'global.tfvars.json';

/** A global stack's second file: `envs`, every env file by name. */
export const ENVS_VAR_FILE = 'envs.tfvars.json';

export function envVarFile(env: string): string {
  return `envs/${env}.tfvars.json`;
}

export function varsDir(paths: TofuPaths): string {
  return `${paths.cacheDir}/vars`;
}

function targetLabel(target: Target): string {
  return `${target.stack}-${target.env ?? 'global'}`;
}

export function planFilePath(paths: TofuPaths, target: Target): string {
  return `${paths.cacheDir}/${targetLabel(target)}.tfplan`;
}

/** The resolved files a target reads, in order (later files win). */
export function varFiles(target: Target): readonly string[] {
  if (target.env === null) return [GLOBAL_VAR_FILE, ENVS_VAR_FILE];
  return [GLOBAL_VAR_FILE, envVarFile(target.env)];
}

/** Global first, then the environment's file — or every env file. */
export function varFileArgs(paths: TofuPaths, target: Target): string[] {
  return varFiles(target).map((file) => `-var-file=${varsDir(paths)}/${file}`);
}

function chdir(paths: TofuPaths, target: Target): string {
  return `-chdir=${stackDir(paths, target.stack)}`;
}

export function initArgs(paths: TofuPaths, target: Target): readonly string[] {
  return [
    chdir(paths, target),
    'init',
    '-input=false',
    '-reconfigure',
    ...varFileArgs(paths, target),
  ];
}

/** Moves local state into the S3 backend (the bootstrap stack's first run). */
export function migrateStateArgs(
  paths: TofuPaths,
  target: Target
): readonly string[] {
  return [
    chdir(paths, target),
    'init',
    '-input=false',
    '-migrate-state',
    '-force-copy',
    ...varFileArgs(paths, target),
  ];
}

/** `-detailed-exitcode`: 0 = no changes, 2 = changes, 1 = error. */
export function planArgs(paths: TofuPaths, target: Target): readonly string[] {
  return [
    chdir(paths, target),
    'plan',
    '-input=false',
    '-detailed-exitcode',
    ...varFileArgs(paths, target),
    `-out=${planFilePath(paths, target)}`,
  ];
}

/**
 * A plan that deletes everything the stack manages — or only `resources`
 * (addresses) when given: the fleet stack tears down one environment's
 * entries, never its neighbours'.
 */
export function destroyPlanArgs(
  paths: TofuPaths,
  target: Target,
  resources: readonly string[] = []
): readonly string[] {
  return [
    chdir(paths, target),
    'plan',
    '-destroy',
    '-input=false',
    '-detailed-exitcode',
    ...varFileArgs(paths, target),
    ...resources.map((address) => `-target=${address}`),
    `-out=${planFilePath(paths, target)}`,
  ];
}

/** The fleet stack's resources for one environment (`stacks/fleet`). */
export function fleetEnvResources(env: string): readonly string[] {
  const key = JSON.stringify(env);
  return [
    `infisical_secret_import.shared[${key}]`,
    `infisical_project_environment.this[${key}]`,
    `railway_environment.this[${key}]`,
  ];
}

export function showArgs(paths: TofuPaths, target: Target): readonly string[] {
  return [chdir(paths, target), 'show', '-json', planFilePath(paths, target)];
}

/** Applies exactly the saved, policy-checked plan — never a fresh one. */
export function applyArgs(paths: TofuPaths, target: Target): readonly string[] {
  return [
    chdir(paths, target),
    'apply',
    '-input=false',
    planFilePath(paths, target),
  ];
}

export function outputArgs(
  paths: TofuPaths,
  target: Target
): readonly string[] {
  // The S3 backend reads `var.env` and `var.state`, so even a read needs them.
  return [
    chdir(paths, target),
    'output',
    '-json',
    ...varFileArgs(paths, target),
  ];
}

/**
 * Secret names (from `secrets-run`) → the variables OpenTofu and its
 * providers read. Missing inputs are reported, never defaulted.
 */
const STATE_CREDENTIALS: Readonly<Record<string, string>> = {
  AWS_ACCESS_KEY_ID: 'TOFU_STATE_ACCESS_KEY_ID',
  AWS_SECRET_ACCESS_KEY: 'TOFU_STATE_SECRET_ACCESS_KEY',
};

const EDGE: Readonly<Record<string, string>> = {
  TF_VAR_state_passphrase: 'TOFU_STATE_PASSPHRASE',
  CLOUDFLARE_API_TOKEN: 'CLOUDFLARE_API_TOKEN',
  ...STATE_CREDENTIALS,
};

export const CREDENTIAL_ENV: Readonly<
  Record<Stack, Readonly<Record<string, string>>>
> = {
  edge: EDGE,
  foundation: {
    ...EDGE,
    RAILWAY_TOKEN: 'RAILWAY_TOKEN',
    PLANETSCALE_SERVICE_TOKEN_ID: 'PLANETSCALE_SERVICE_TOKEN_ID',
    PLANETSCALE_SERVICE_TOKEN: 'PLANETSCALE_SERVICE_TOKEN',
    GRAFANA_CLOUD_ACCESS_POLICY_TOKEN: 'GRAFANA_CLOUD_API_TOKEN',
  },
  fleet: {
    TF_VAR_state_passphrase: 'TOFU_STATE_PASSPHRASE',
    CLOUDFLARE_API_TOKEN: 'CLOUDFLARE_API_TOKEN',
    RAILWAY_TOKEN: 'RAILWAY_TOKEN',
    ...STATE_CREDENTIALS,
  },
  // The state credential is optional here: bootstrap creates it.
  bootstrap: {
    TF_VAR_state_passphrase: 'TOFU_STATE_PASSPHRASE',
    CLOUDFLARE_API_TOKEN: 'CLOUDFLARE_API_TOKEN',
    GITHUB_TOKEN: 'GITHUB_ADMIN_TOKEN',
    GRAFANA_CLOUD_ACCESS_POLICY_TOKEN: 'GRAFANA_CLOUD_API_TOKEN',
  },
};

export type TofuEnvResult = {
  readonly env: Readonly<Record<string, string>>;
  readonly missing: readonly string[];
};

function copyCredentials(
  secrets: Readonly<Record<string, string | undefined>>,
  mapping: Readonly<Record<string, string>>,
  env: Record<string, string>
): string[] {
  const missing: string[] = [];
  for (const [target, source] of Object.entries(mapping)) {
    const value = secrets[source]?.trim() ?? '';
    if (value.length === 0) missing.push(source);
    else env[target] = value;
  }
  return missing;
}

export function tofuEnvironment(
  secrets: Readonly<Record<string, string | undefined>>,
  paths: TofuPaths,
  target: Target,
  aws: AwsSession | null = null
): TofuEnvResult {
  const { env, missing } = tofuCredentialEnvironment(
    secrets,
    paths,
    target,
    CREDENTIAL_ENV[target.stack]
  );
  if (target.stack === 'bootstrap')
    copyCredentials(secrets, STATE_CREDENTIALS, env);
  if (target.stack === 'foundation' || target.stack === 'bootstrap')
    writeAwsProvider(secrets, env, missing, aws);
  return { env, missing };
}

/** Assemble only the credentials used by the selected provider graph. */
export function tofuCredentialEnvironment(
  secrets: Readonly<Record<string, string | undefined>>,
  paths: TofuPaths,
  target: Target,
  mapping: Readonly<Record<string, string>>
): { env: Record<string, string>; missing: string[] } {
  const env: Record<string, string> = {
    TF_IN_AUTOMATION: '1',
    TF_INPUT: '0',
    TF_DATA_DIR: `${paths.cacheDir}/data/${targetLabel(target)}`,
    TF_PLUGIN_CACHE_DIR: `${paths.cacheDir}/plugins`,
  };
  const missing = copyCredentials(secrets, mapping, env);
  return { env, missing };
}

/**
 * The child process's `AWS_ACCESS_KEY_ID` is the R2 state key. A session
 * from GitHub OIDC or the local AWS CLI wins; otherwise long-lived account
 * keys, including the `AWS_ACCESS_KEY_ID` name already in the secret store.
 */
function writeAwsProvider(
  secrets: Readonly<Record<string, string | undefined>>,
  env: Record<string, string>,
  missing: string[],
  aws: AwsSession | null
): void {
  const credentials = aws ?? accountKeySession(secrets);
  if (credentials === null) {
    missing.push('AWS_ROLE_ARN');
    return;
  }
  env['TF_VAR_aws_access_key_id'] = credentials.accessKeyId;
  env['TF_VAR_aws_secret_access_key'] = credentials.secretAccessKey;
  if (credentials.sessionToken.length > 0)
    env['TF_VAR_aws_session_token'] = credentials.sessionToken;
}

export function missingSecretsMessage(
  stack: Stack,
  missing: readonly string[]
): string {
  const hint = missing.some((name) => name.startsWith('TOFU_STATE_ACCESS'))
    ? 'run `bun run infra:bootstrap` first'
    : missing.includes('AWS_ROLE_ARN')
      ? 'set AWS_ROLE_ARN (GitHub OIDC, written by infra:bootstrap) or log in with the AWS CLI'
      : 'bun run secrets:seed';
  return `missing secrets for the ${stack} stack: ${missing.join(', ')} (${hint})`;
}

/** Bootstrap has run once the state credential exists in the store. */
export function stateBackendExists(
  secrets: Readonly<Record<string, string | undefined>>
): boolean {
  return Object.values(STATE_CREDENTIALS).every(
    (name) => (secrets[name]?.trim() ?? '').length > 0
  );
}

/**
 * The override file that points the bootstrap stack at a local backend for
 * its very first apply (the bucket it creates does not exist yet).
 */
export function localBackendOverride(statePath: string): string {
  return `terraform {\n  backend "local" {\n    path = ${JSON.stringify(statePath)}\n  }\n}\n`;
}
