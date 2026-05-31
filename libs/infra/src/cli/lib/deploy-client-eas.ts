import { assert } from '@pkgs/assert';
import { COMMIT_HASH_HEX_REGEX } from '@pkgs/git';
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
 * Native build profile matrix per environment — mirrors the matrix the
 * `eas-mobile` GitHub Actions job used. iOS produces a simulator build in
 * CI because device signing requires interactive certificate validation.
 */
const EAS_BUILD_MATRIX: Record<
  EasProfile,
  ReadonlyArray<{ platform: 'android' | 'ios'; profile: string }>
> = {
  production: [
    { platform: 'android', profile: 'production' },
    { platform: 'ios', profile: 'production-simulator' },
  ],
  development: [
    { platform: 'android', profile: 'development' },
    { platform: 'ios', profile: 'development-simulator' },
  ],
};

/**
 * Resolve the EAS profile to deploy. Explicit `EAS_PROFILE` env wins; in
 * GitHub Actions a push to `main` defaults to `production`. Returns `null`
 * when EAS should be skipped (local `infra deploy` with no explicit
 * `EAS_PROFILE` — prevents accidental cloud builds from a workstation).
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

function resolveCommitHash(): string {
  const fromEnv = process.env['EXPO_PUBLIC_COMMIT_HASH']?.trim().toLowerCase();
  if (fromEnv !== undefined && fromEnv.length > 0) {
    assert.ok(
      COMMIT_HASH_HEX_REGEX.test(fromEnv),
      'deploy-client-eas: EXPO_PUBLIC_COMMIT_HASH must be a lowercase hex commit SHA',
      { fromEnv }
    );
    return fromEnv;
  }
  const rawSha = runCapture('git', ['rev-parse', 'HEAD'], { cwd: REPO_ROOT });
  const commitHash = rawSha.trim().toLowerCase();
  assert.ok(
    COMMIT_HASH_HEX_REGEX.test(commitHash),
    'deploy-client-eas: git HEAD must be a valid lowercase hex commit SHA',
    { rawSha }
  );
  return commitHash;
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
function easEnv(commitHash: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    EXPO_PUBLIC_COMMIT_HASH: commitHash,
    EXPO_PUBLIC_ALLOW_PRODUCTION_API_URL: '1',
  };
}

/**
 * Fire native EAS Build (Android + iOS simulator) without waiting — the
 * cloud builds run independently (~15-30 min) — then publish an OTA
 * `eas update` so the matching JS bundle reaches dev clients + Expo Go on
 * the same channel.
 *
 * Runs in `apps/client` so EAS resolves the right project (all EAS config
 * lives there per https://docs.expo.dev/build-reference/build-with-monorepos).
 */
export async function deployClientEas(
  platform: CiPlatform,
  profile: EasProfile
): Promise<void> {
  assertExpoTokenPresent();
  const commitHash = resolveCommitHash();
  const clientDir = join(REPO_ROOT, 'apps/client');
  const env = easEnv(commitHash);

  for (const { platform: target, profile: buildProfile } of EAS_BUILD_MATRIX[
    profile
  ]) {
    await runAsync(
      platform,
      'eas',
      [
        'build',
        '--platform',
        target,
        '--profile',
        buildProfile,
        '--non-interactive',
        '--no-wait',
      ],
      {
        cwd: clientDir,
        env,
        label: `eas build: ${target} (${buildProfile})`,
      }
    );
  }

  // Compile i18n + bundle the WASM workers before the OTA bundle. The
  // `eas-build-post-install` hook only runs on EAS Build workers, not for a
  // locally-run `eas update`.
  await runAsync(platform, 'bun', ['run', 'prebuild'], {
    cwd: clientDir,
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
      cwd: clientDir,
      env,
      label: `eas update: ${profile} channel`,
    }
  );

  platform.notice(
    `EAS native builds fired and OTA update published (${profile} channel).`
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
    'deploy-client-eas: EXPO_TOKEN is required for EAS CLI auth. ' +
      'Set it in Doppler (config prd) or export EXPO_TOKEN before running.'
  );
}

/**
 * Resolve + log whether EAS will deploy. Returns the profile, or `null`
 * (with a skip notice) when EAS should be skipped.
 */
export function resolveEasProfileWithNotice(
  platform: CiPlatform
): EasProfile | null {
  const profile = resolveEasProfile();
  if (profile === null) {
    platform.notice(
      'deploy-client-eas skipped — set EAS_PROFILE=development to deploy the mobile client locally.'
    );
    return null;
  }
  ok('deploy-client-eas', `profile ${profile}`);
  return profile;
}
