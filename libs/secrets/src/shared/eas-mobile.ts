import { join } from 'node:path';
import { assert } from '@pkgs/assert';
import { assertCommitDateIso, COMMIT_HASH_HEX_REGEX } from '@pkgs/git';
import { createLogger } from '@pkgs/logger';
import { cliClock } from './cli-io';
import { productionApiOrigin } from './deploy-origins';
import { ok } from './fmt';
import { REPO_ROOT } from './paths';
import { runAsync, runCapture } from './subprocess';

const log = createLogger({ name: 'secrets:eas-mobile', now: cliClock.now });

export type EasProfile = 'production' | 'development';

export function resolveEasProfile(): EasProfile | null {
  const raw = process.env['EAS_PROFILE']?.trim();
  if (raw === 'production' || raw === 'development') return raw;
  if (raw !== undefined && raw.length > 0) {
    assert.fail(
      `EAS_PROFILE must be "production" or "development" (got: ${raw})`
    );
  }
  if (process.env['GITHUB_ACTIONS'] === 'true') return 'production';
  return null;
}

export function requireEasProfile(): EasProfile {
  const profile = resolveEasProfile();
  assert.ok(
    profile !== null,
    'eas build: EAS_PROFILE must be set to "production" or "development" ' +
      '(refusing to build/submit native binaries without an explicit profile)'
  );
  return profile;
}

const EAS_UPDATE_MAX_OLD_SPACE_MB = 8192;

export function withNodeMaxOldSpaceSize(
  env: NodeJS.ProcessEnv,
  mb: number
): NodeJS.ProcessEnv {
  const flag = `--max-old-space-size=${String(mb)}`;
  const existing = env['NODE_OPTIONS']?.trim();
  if (existing === undefined || existing.length === 0) {
    return { ...env, NODE_OPTIONS: flag };
  }
  if (/(?:^|\s)--max-old-space-size=\d+(?=\s|$)/.test(existing)) {
    return {
      ...env,
      NODE_OPTIONS: existing.replace(/--max-old-space-size=\d+/g, flag),
    };
  }
  return { ...env, NODE_OPTIONS: `${existing} ${flag}` };
}

function resolveCommitHash(): string {
  const fromEnv = process.env['EXPO_PUBLIC_COMMIT_HASH']?.trim().toLowerCase();
  if (fromEnv !== undefined && fromEnv.length > 0) {
    assert.ok(
      COMMIT_HASH_HEX_REGEX.test(fromEnv),
      'eas-mobile: EXPO_PUBLIC_COMMIT_HASH must be a lowercase hex commit SHA',
      { fromEnv }
    );
    return fromEnv;
  }
  const rawSha = runCapture('git', ['rev-parse', 'HEAD'], { cwd: REPO_ROOT });
  const commitHash = rawSha.trim().toLowerCase();
  assert.ok(
    COMMIT_HASH_HEX_REGEX.test(commitHash),
    'eas-mobile: git HEAD must be a valid lowercase hex commit SHA',
    { rawSha }
  );
  return commitHash;
}

function resolveCommitDate(): string {
  const fromEnv = process.env['EXPO_PUBLIC_COMMIT_DATE']?.trim();
  if (fromEnv !== undefined && fromEnv.length > 0) {
    assertCommitDateIso(fromEnv);
    return fromEnv;
  }
  const rawDate = runCapture('git', ['log', '-1', '--format=%cI', 'HEAD'], {
    cwd: REPO_ROOT,
  });
  const commitDate = rawDate.trim();
  assertCommitDateIso(commitDate);
  return commitDate;
}

function easEnv(commitHash: string, commitDate: string): NodeJS.ProcessEnv {
  return withNodeMaxOldSpaceSize(
    {
      ...process.env,
      EXPO_PUBLIC_API_URL: productionApiOrigin(),
      EXPO_PUBLIC_COMMIT_HASH: commitHash,
      EXPO_PUBLIC_COMMIT_DATE: commitDate,
      EXPO_PUBLIC_ALLOW_PRODUCTION_API_URL: '1',
    },
    EAS_UPDATE_MAX_OLD_SPACE_MB
  );
}

function clientDir(): string {
  return join(REPO_ROOT, 'apps/client');
}

export function assertExpoTokenPresent(): void {
  const token = process.env['EXPO_TOKEN']?.trim();
  assert.nonEmptyString(
    token,
    'eas-mobile: EXPO_TOKEN is required for EAS CLI auth. ' +
      'Set it in the secret store (config prd) or export EXPO_TOKEN before running.'
  );
}

export function resolveEasProfileWithNotice(): EasProfile | null {
  const profile = resolveEasProfile();
  if (profile === null) {
    log.info(
      'eas update skipped — set EAS_PROFILE=development to publish an OTA update locally.'
    );
    return null;
  }
  ok('eas update', `profile ${profile}`);
  return profile;
}

export async function publishClientEasUpdate(
  profile: EasProfile
): Promise<void> {
  assertExpoTokenPresent();
  const commitHash = resolveCommitHash();
  const commitDate = resolveCommitDate();
  const cwd = clientDir();
  const env = easEnv(commitHash, commitDate);

  await runAsync('bun', ['run', 'check:production-env'], {
    cwd,
    env,
    label: 'eas update: production client build env gate',
  });

  await runAsync('bun', ['run', 'prebuild'], {
    cwd,
    env,
    label: 'client: prebuild (i18n + wasm bundles)',
  });

  await runAsync(
    'eas',
    [
      'update',
      '--channel',
      profile,
      '--environment',
      profile,
      '--message',
      commitHash,
      '--non-interactive',
    ],
    {
      cwd,
      env,
      label: `eas update: ${profile} channel`,
    }
  );

  log.info(`EAS OTA update published (${profile} channel).`);
}

export async function buildAndSubmitClientNative(
  profile: EasProfile
): Promise<void> {
  assertExpoTokenPresent();
  const commitHash = resolveCommitHash();
  const commitDate = resolveCommitDate();
  const cwd = clientDir();
  const env = easEnv(commitHash, commitDate);

  const args = [
    'build',
    '--platform',
    'all',
    '--profile',
    profile,
    '--message',
    commitHash,
    '--non-interactive',
  ];
  if (profile === 'production') args.push('--auto-submit');

  await runAsync('eas', args, {
    cwd,
    env,
    label: `eas build: all (${profile})${profile === 'production' ? ' + submit' : ''}`,
  });

  log.info(
    profile === 'production'
      ? 'EAS native build + store submission complete (production).'
      : `EAS native build complete (${profile}).`
  );
}
