import { assert } from '@pkgs/assert';
import { COMMIT_HASH_HEX_REGEX, assertCommitDateIso } from '@pkgs/git';
import { join } from 'node:path';
import type { CiPlatform } from '../platform/platform';
import { REPO_ROOT } from '../paths';
import { runAsync, runCapture } from '../subprocess';
import { ok } from './fmt';

/**
 * EAS profile / channel. `production` ships from a push to `main`;
 * `development` is for manual / local dev builds. Profile and channel
 * always share a name (see `apps/client/eas.json`).
 */
export type EasProfile = 'production' | 'development';

/**
 * Resolve the EAS profile. Explicit `EAS_PROFILE` env wins; in GitHub
 * Actions a push to `main` defaults to `production`. Returns `null` when no
 * profile resolves (local invocation with no explicit `EAS_PROFILE`) — the
 * OTA path treats that as "skip", the native build path treats it as a hard
 * error (see {@link requireEasProfile}).
 */
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

/**
 * Like {@link resolveEasProfile} but never `null`: native builds + store
 * submission are explicit, irreversible actions, so a missing profile is a
 * hard error rather than a silent skip — prevents an accidental release from
 * a developer workstation.
 */
export function requireEasProfile(): EasProfile {
  const profile = resolveEasProfile();
  assert.ok(
    profile !== null,
    'eas build: EAS_PROFILE must be set to "production" or "development" ' +
      '(refusing to build/submit native binaries without an explicit profile)'
  );
  return profile;
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
  const rawDate = runCapture(
    'git',
    ['log', '-1', '--format=%cI', 'HEAD'],
    { cwd: REPO_ROOT }
  );
  const commitDate = rawDate.trim();
  assertCommitDateIso(commitDate);
  return commitDate;
}

/**
 * Subprocess env for `eas`. `EXPO_TOKEN` authenticates the CLI; the
 * `EXPO_PUBLIC_*` vars are inlined into the OTA bundle by Metro during
 * `eas update` (which bundles on this runner, unlike `eas build` which
 * reads `eas.json` profile env on EAS workers). `EXPO_PUBLIC_API_URL`
 * resolves to the production API origin; `EXPO_PUBLIC_ALLOW_PRODUCTION_API_URL`
 * opts the dev/Expo-Go bundle past the Tiger production-API guard
 * (see `apps/client/src/config/api-servers.ts`).
 */
function easEnv(commitHash: string, commitDate: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    EXPO_PUBLIC_COMMIT_HASH: commitHash,
    EXPO_PUBLIC_COMMIT_DATE: commitDate,
    EXPO_PUBLIC_ALLOW_PRODUCTION_API_URL: '1',
  };
}

function clientDir(): string {
  return join(REPO_ROOT, 'apps/client');
}

/**
 * Publish an OTA `eas update` so the matching JS bundle reaches clients +
 * Expo Go on the channel for `profile`. This is the only EAS action the
 * routine `infra deploy` runs — native deps rarely change, so a push to
 * `main` is almost always JS-only. Native binaries are produced separately
 * by {@link buildAndSubmitClientNative} (manual workflow).
 *
 * Runs in `apps/client` so EAS resolves the right project (all EAS config
 * lives there per https://docs.expo.dev/build-reference/build-with-monorepos).
 */
export async function publishClientEasUpdate(
  platform: CiPlatform,
  profile: EasProfile
): Promise<void> {
  assertExpoTokenPresent();
  const commitHash = resolveCommitHash();
  const commitDate = resolveCommitDate();
  const cwd = clientDir();
  const env = easEnv(commitHash, commitDate);

  // Compile i18n + bundle the WASM workers before the OTA bundle. The
  // `eas-build-post-install` hook only runs on EAS Build workers, not for a
  // locally-run `eas update`.
  await runAsync(platform, 'bun', ['run', 'prebuild'], {
    cwd,
    env,
    label: 'client: prebuild (i18n + wasm bundles)',
  });

  await runAsync(
    platform,
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

  platform.notice(`EAS OTA update published (${profile} channel).`);
}

/**
 * Build native binaries (Android + iOS, in parallel on EAS) and, for
 * `production`, submit them to the App Store / Play Store via `--auto-submit`
 * (uses the same-named submit profile in `apps/client/eas.json`).
 *
 * Manual / rare: run only when native deps actually change. Waits for the
 * builds (no `--no-wait`) so a release surfaces failures in the workflow.
 *
 * Prerequisite: production store credentials must be configured on EAS for
 * `--auto-submit` to succeed in `--non-interactive` mode.
 */
export async function buildAndSubmitClientNative(
  platform: CiPlatform,
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
  // Only production releases go to the stores; the `development` profile is
  // an internal-distribution build with no matching submit profile.
  if (profile === 'production') args.push('--auto-submit');

  await runAsync(platform, 'eas', args, {
    cwd,
    env,
    label: `eas build: all (${profile})${profile === 'production' ? ' + submit' : ''}`,
  });

  platform.notice(
    profile === 'production'
      ? 'EAS native build + store submission complete (production).'
      : `EAS native build complete (${profile}).`
  );
}

/**
 * Cheap, network-free precondition: EAS CLI auth requires `EXPO_TOKEN`.
 * Exported so the client dry-run can fail fast in CI before any build.
 */
export function assertExpoTokenPresent(): void {
  const token = process.env['EXPO_TOKEN']?.trim();
  assert.nonEmptyString(
    token,
    'eas-mobile: EXPO_TOKEN is required for EAS CLI auth. ' +
      'Set it in Vault (config prd) or export EXPO_TOKEN before running.'
  );
}

/**
 * Resolve + log whether the OTA update will run. Returns the profile, or
 * `null` (with a skip notice) when no profile resolves.
 */
export function resolveEasProfileWithNotice(
  platform: CiPlatform
): EasProfile | null {
  const profile = resolveEasProfile();
  if (profile === null) {
    platform.notice(
      'eas update skipped — set EAS_PROFILE=development to publish an OTA update locally.'
    );
    return null;
  }
  ok('eas update', `profile ${profile}`);
  return profile;
}
